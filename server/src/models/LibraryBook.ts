import mongoose, { Schema, Document } from 'mongoose';

export interface ILibraryBook extends Document {
    isbn: string;
    title: string;
    author: string;
    category: string;
    copiesTotal: number;
    copiesAvailable: number;
    shelfLocation: string;
    branchId: string;
    status: string;
}

const LibraryBookSchema: Schema = new Schema(
    {
        isbn: { type: String, required: true },
        title: { type: String, required: true },
        author: { type: String, required: true },
        category: { type: String, default: 'General' },
        copiesTotal: { type: Number, default: 1 },
        copiesAvailable: { type: Number, default: 1 },
        shelfLocation: { type: String, default: '' },
        branchId: { type: String, default: '' },
        status: { type: String, default: 'AVAILABLE' },
    },
    { timestamps: true }
);

export const LibraryBookModel = mongoose.models.LibraryBook || mongoose.model<ILibraryBook>('LibraryBook', LibraryBookSchema);
