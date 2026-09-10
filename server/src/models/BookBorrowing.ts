import mongoose, { Schema, Document } from 'mongoose';

export interface IBookBorrowing extends Document {
    bookId: string;
    bookTitle: string;
    isbn: string;
    borrowerName: string;
    borrowerType: string;      // STUDENT | STAFF
    borrowerId: string;        // studentId or staffId
    borrowerLevel?: string;    // class level for students
    branchId: string;
    borrowDate: string;
    dueDate: string;
    returnDate?: string;
    status: string;            // BORROWED | RETURNED | OVERDUE
    fineGHS: number;
    finePaid: boolean;
}

const BookBorrowingSchema: Schema = new Schema(
    {
        bookId: { type: String, required: true },
        bookTitle: { type: String, required: true },
        isbn: { type: String, default: '' },
        borrowerName: { type: String, required: true },
        borrowerType: { type: String, enum: ['STUDENT', 'STAFF'], default: 'STUDENT' },
        borrowerId: { type: String, default: '' },
        borrowerLevel: { type: String, default: '' },
        branchId: { type: String, default: '' },
        borrowDate: { type: String, required: true },
        dueDate: { type: String, required: true },
        returnDate: { type: String, default: null },
        status: { type: String, enum: ['BORROWED', 'RETURNED', 'OVERDUE'], default: 'BORROWED' },
        fineGHS: { type: Number, default: 0 },
        finePaid: { type: Boolean, default: false },
    },
    { timestamps: true }
);

export const BookBorrowingModel = mongoose.models.BookBorrowing || mongoose.model<IBookBorrowing>('BookBorrowing', BookBorrowingSchema);
