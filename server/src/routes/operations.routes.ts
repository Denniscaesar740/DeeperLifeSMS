import { Router, Request, Response } from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { LibraryBookModel } from '../models/LibraryBook.js';
import { BookBorrowingModel } from '../models/BookBorrowing.js';
import { TransportRouteModel } from '../models/TransportRoute.js';
import { ClinicVisitModel } from '../models/ClinicVisit.js';
import { GatePassModel } from '../models/GatePass.js';

export const operationsRouter = Router();

function fmt(doc: any) {
    if (!doc) return doc;
    const obj = doc.toJSON ? doc.toJSON() : { ...doc };
    obj.id = obj._id?.toString() || obj.id;
    return obj;
}

// ═══════════════════════════════════════════════════════════
// 1. LIBRARY CATALOGUE
// ═══════════════════════════════════════════════════════════

// GET all library books
operationsRouter.get('/library/books', authenticateToken, async (req: Request, res: Response) => {
    try {
        const filter: any = {};
        if (req.query.branchId && req.query.branchId !== 'ALL') filter.branchId = req.query.branchId;
        if (req.query.category) filter.category = req.query.category;
        if (req.query.search) {
            const s = String(req.query.search);
            filter.$or = [
                { title: { $regex: s, $options: 'i' } },
                { author: { $regex: s, $options: 'i' } },
                { isbn: { $regex: s, $options: 'i' } },
            ];
        }
        const books = await LibraryBookModel.find(filter).sort({ createdAt: -1 }).lean();
        return res.json({ count: books.length, books: books.map(fmt) });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// POST create book
operationsRouter.post('/library/books', authenticateToken, async (req: Request, res: Response) => {
    const { isbn, title, author, category, copiesTotal, shelfLocation, branchId } = req.body;
    if (!title || !author) {
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'Title and author are required.' });
    }
    try {
        const book = await LibraryBookModel.create({
            isbn: isbn || '',
            title,
            author,
            category: category || 'General',
            copiesTotal: Number(copiesTotal) || 1,
            copiesAvailable: Number(copiesTotal) || 1,
            shelfLocation: shelfLocation || '',
            branchId: branchId || '',
            status: 'AVAILABLE',
        });
        return res.status(201).json({ message: 'Book catalogued successfully.', book: fmt(book) });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// PUT update book
operationsRouter.put('/library/books/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
        const book = await LibraryBookModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!book) return res.status(404).json({ error: 'NOT_FOUND', message: 'Book not found.' });
        return res.json({ message: 'Book updated.', book: fmt(book) });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// DELETE book
operationsRouter.delete('/library/books/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
        await LibraryBookModel.findByIdAndDelete(req.params.id);
        return res.json({ message: 'Book deleted.' });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// GET all borrowings
operationsRouter.get('/library/borrowings', authenticateToken, async (req: Request, res: Response) => {
    try {
        const filter: any = {};
        if (req.query.status) filter.status = req.query.status;
        if (req.query.branchId && req.query.branchId !== 'ALL') filter.branchId = req.query.branchId;
        const borrowings = await BookBorrowingModel.find(filter).sort({ createdAt: -1 }).lean();
        return res.json({ count: borrowings.length, borrowings: borrowings.map(fmt) });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// POST borrow a book (checkout)
operationsRouter.post('/library/borrow', authenticateToken, async (req: Request, res: Response) => {
    const { bookId, borrowerName, borrowerType, borrowerId, borrowerLevel, branchId, dueDate } = req.body;
    if (!bookId || !borrowerName) {
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'bookId and borrowerName are required.' });
    }
    try {
        const book = await LibraryBookModel.findById(bookId);
        if (!book) return res.status(404).json({ error: 'NOT_FOUND', message: 'Book not found.' });
        if (book.copiesAvailable <= 0) {
            return res.status(400).json({ error: 'NO_COPIES', message: 'No copies available for borrowing.' });
        }

        // Decrement available copies
        book.copiesAvailable -= 1;
        if (book.copiesAvailable === 0) book.status = 'ALL_BORROWED';
        await book.save();

        const today = new Date().toISOString().split('T')[0];
        const defaultDue = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const borrowing = await BookBorrowingModel.create({
            bookId: book._id.toString(),
            bookTitle: book.title,
            isbn: book.isbn,
            borrowerName,
            borrowerType: borrowerType || 'STUDENT',
            borrowerId: borrowerId || '',
            borrowerLevel: borrowerLevel || '',
            branchId: branchId || book.branchId || '',
            borrowDate: today,
            dueDate: dueDate || defaultDue,
            status: 'BORROWED',
            fineGHS: 0,
            finePaid: false,
        });

        return res.status(201).json({ message: 'Book checked out successfully.', borrowing: fmt(borrowing) });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// PATCH return a book
operationsRouter.patch('/library/return/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
        const borrowing = await BookBorrowingModel.findById(req.params.id);
        if (!borrowing) return res.status(404).json({ error: 'NOT_FOUND', message: 'Borrowing record not found.' });

        const today = new Date().toISOString().split('T')[0];
        borrowing.returnDate = today;
        borrowing.status = 'RETURNED';

        // Calculate overdue fine: GHS 0.50 per day overdue
        const dueMs = new Date(borrowing.dueDate).getTime();
        const todayMs = new Date(today).getTime();
        if (todayMs > dueMs) {
            const overdueDays = Math.ceil((todayMs - dueMs) / (1000 * 60 * 60 * 24));
            borrowing.fineGHS = overdueDays * 0.50;
        }

        await borrowing.save();

        // Increment available copies back
        await LibraryBookModel.findByIdAndUpdate(borrowing.bookId, {
            $inc: { copiesAvailable: 1 },
            $set: { status: 'AVAILABLE' },
        });

        return res.json({ message: 'Book returned successfully.', borrowing: fmt(borrowing) });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// ═══════════════════════════════════════════════════════════
// 2. TRANSPORT & BUS LOGISTICS
// ═══════════════════════════════════════════════════════════

// GET all routes
operationsRouter.get('/transport/routes', authenticateToken, async (req: Request, res: Response) => {
    try {
        const filter: any = {};
        if (req.query.branchId && req.query.branchId !== 'ALL') filter.branchId = req.query.branchId;
        if (req.query.status) filter.status = req.query.status;
        const routes = await TransportRouteModel.find(filter).sort({ routeName: 1 }).lean();
        return res.json({ count: routes.length, routes: routes.map(fmt) });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// POST create route
operationsRouter.post('/transport/routes', authenticateToken, async (req: Request, res: Response) => {
    const { routeName, vehicleNo, driverName, driverPhone } = req.body;
    if (!routeName || !vehicleNo || !driverName || !driverPhone) {
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'routeName, vehicleNo, driverName, and driverPhone are required.' });
    }
    try {
        const route = await TransportRouteModel.create(req.body);
        return res.status(201).json({ message: 'Route created successfully.', route: fmt(route) });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// PUT update route
operationsRouter.put('/transport/routes/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
        const route = await TransportRouteModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!route) return res.status(404).json({ error: 'NOT_FOUND', message: 'Route not found.' });
        return res.json({ message: 'Route updated.', route: fmt(route) });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// DELETE route
operationsRouter.delete('/transport/routes/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
        await TransportRouteModel.findByIdAndDelete(req.params.id);
        return res.json({ message: 'Route deleted.' });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// ═══════════════════════════════════════════════════════════
// 3. HEALTH CLINIC DESK
// ═══════════════════════════════════════════════════════════

// GET all clinic visits
operationsRouter.get('/clinic/visits', authenticateToken, async (req: Request, res: Response) => {
    try {
        const filter: any = {};
        if (req.query.branchId && req.query.branchId !== 'ALL') filter.branchId = req.query.branchId;
        if (req.query.studentId) filter.studentId = req.query.studentId;
        if (req.query.status) filter.status = req.query.status;
        if (req.query.date) filter.visitDate = req.query.date;
        const visits = await ClinicVisitModel.find(filter).sort({ createdAt: -1 }).lean();
        return res.json({ count: visits.length, visits: visits.map(fmt) });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// POST create clinic visit
operationsRouter.post('/clinic/visits', authenticateToken, async (req: Request, res: Response) => {
    const { studentName, complaint, treatmentGiven, nurseName } = req.body;
    if (!studentName || !complaint || !treatmentGiven || !nurseName) {
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'studentName, complaint, treatmentGiven, and nurseName are required.' });
    }
    try {
        const today = new Date();
        const visit = await ClinicVisitModel.create({
            ...req.body,
            visitDate: req.body.visitDate || today.toISOString().split('T')[0],
            visitTime: req.body.visitTime || today.toTimeString().slice(0, 5),
            status: req.body.referredToHospital ? 'REFERRED' : 'TREATED',
        });
        return res.status(201).json({ message: 'Clinic visit recorded.', visit: fmt(visit) });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// PUT update clinic visit
operationsRouter.put('/clinic/visits/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
        const visit = await ClinicVisitModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!visit) return res.status(404).json({ error: 'NOT_FOUND', message: 'Visit not found.' });
        return res.json({ message: 'Visit updated.', visit: fmt(visit) });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// GET student medical history (all visits for a student)
operationsRouter.get('/clinic/history/:studentId', authenticateToken, async (req: Request, res: Response) => {
    try {
        const visits = await ClinicVisitModel.find({ studentId: req.params.studentId }).sort({ createdAt: -1 }).lean();
        return res.json({ count: visits.length, visits: visits.map(fmt) });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// ═══════════════════════════════════════════════════════════
// 4. GATE SECURITY & VISITOR CLEARANCE
// ═══════════════════════════════════════════════════════════

// GET all gate passes
operationsRouter.get('/gate/passes', authenticateToken, async (req: Request, res: Response) => {
    try {
        const filter: any = {};
        if (req.query.branchId && req.query.branchId !== 'ALL') filter.branchId = req.query.branchId;
        if (req.query.status) filter.status = req.query.status;
        if (req.query.date) {
            filter.entryTime = { $regex: `^${req.query.date}` };
        }
        const passes = await GatePassModel.find(filter).sort({ createdAt: -1 }).lean();
        return res.json({ count: passes.length, passes: passes.map(fmt) });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// POST create gate pass (visitor check-in)
operationsRouter.post('/gate/passes', authenticateToken, async (req: Request, res: Response) => {
    const { visitorName, purpose, destination, issuedBy } = req.body;
    if (!visitorName || !purpose || !destination || !issuedBy) {
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'visitorName, purpose, destination, and issuedBy are required.' });
    }
    try {
        // Auto-generate badge number
        const count = await GatePassModel.countDocuments();
        const badgeNo = `V-${String(count + 1).padStart(4, '0')}`;
        const now = new Date();

        const pass = await GatePassModel.create({
            ...req.body,
            badgeNo,
            entryTime: req.body.entryTime || now.toISOString(),
            status: 'CHECKED_IN',
        });
        return res.status(201).json({ message: 'Visitor checked in. Badge issued.', pass: fmt(pass) });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// PATCH checkout visitor (exit)
operationsRouter.patch('/gate/checkout/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
        const pass = await GatePassModel.findById(req.params.id);
        if (!pass) return res.status(404).json({ error: 'NOT_FOUND', message: 'Gate pass not found.' });

        pass.exitTime = new Date().toISOString();
        pass.status = 'CHECKED_OUT';
        await pass.save();

        return res.json({ message: 'Visitor checked out.', pass: fmt(pass) });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// PATCH deny visitor
operationsRouter.patch('/gate/deny/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
        const pass = await GatePassModel.findByIdAndUpdate(
            req.params.id,
            { status: 'DENIED' },
            { new: true }
        );
        if (!pass) return res.status(404).json({ error: 'NOT_FOUND', message: 'Gate pass not found.' });
        return res.json({ message: 'Visitor denied entry.', pass: fmt(pass) });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});

// GET statistics summary for operations dashboard
operationsRouter.get('/stats', authenticateToken, async (req: Request, res: Response) => {
    try {
        const filter: any = {};
        if (req.query.branchId && req.query.branchId !== 'ALL') filter.branchId = req.query.branchId;

        const [bookCount, borrowedCount, overdueCount, routeCount, todayVisits, activeVisitors] = await Promise.all([
            LibraryBookModel.countDocuments(filter),
            BookBorrowingModel.countDocuments({ ...filter, status: 'BORROWED' }),
            BookBorrowingModel.countDocuments({ ...filter, status: 'OVERDUE' }),
            TransportRouteModel.countDocuments({ ...filter, status: 'ACTIVE' }),
            ClinicVisitModel.countDocuments({ ...filter, visitDate: new Date().toISOString().split('T')[0] }),
            GatePassModel.countDocuments({ ...filter, status: 'CHECKED_IN' }),
        ]);

        return res.json({
            library: { totalBooks: bookCount, activeBorrowings: borrowedCount, overdue: overdueCount },
            transport: { activeRoutes: routeCount },
            clinic: { todayVisits },
            gate: { activeVisitors },
        });
    } catch (err: any) {
        return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
});
