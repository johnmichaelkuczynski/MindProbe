import multer from 'multer';
import { Request } from 'express';
import fs from 'fs';
import path from 'path';

// For PDF processing
const pdfParse = async (buffer: Buffer): Promise<string> => {
  try {
    const pdf = await import('pdf-parse');
    const data = await pdf.default(buffer);
    return data.text;
  } catch (error) {
    throw new Error('Failed to parse PDF file');
  }
};

// For Word document processing
const mammoth = async (buffer: Buffer): Promise<string> => {
  try {
    const mammothLib = await import('mammoth');
    const result = await mammothLib.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    throw new Error('Failed to parse Word document');
  }
};

export const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req: Request, file: any, cb: multer.FileFilterCallback) => {
    const allowedMimeTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain',
    ];
    
    const allowedExtensions = ['.pdf', '.docx', '.doc', '.txt'];
    const fileExtension = path.extname(file.originalname).toLowerCase();
    
    if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, Word, and text files are allowed.'));
    }
  },
});

export class FileProcessor {
  static async extractText(file: any): Promise<string> {
    const { buffer, mimetype, originalname } = file;
    const extension = path.extname(originalname).toLowerCase();

    try {
      switch (true) {
        case mimetype === 'application/pdf' || extension === '.pdf':
          return await pdfParse(buffer);
        
        case mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
             mimetype === 'application/msword' ||
             extension === '.docx' || 
             extension === '.doc':
          return await mammoth(buffer);
        
        case mimetype === 'text/plain' || extension === '.txt':
          return buffer.toString('utf-8');
        
        default:
          throw new Error('Unsupported file type');
      }
    } catch (error) {
      console.error('File processing error:', error);
      throw new Error(`Failed to process file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static validateFile(file: any): { valid: boolean; error?: string } {
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (!allowedTypes.includes(file.mimetype)) {
      return { valid: false, error: 'Invalid file type. Only PDF, Word, and text files are allowed.' };
    }

    if (file.size > maxSize) {
      return { valid: false, error: 'File size exceeds 10MB limit.' };
    }

    return { valid: true };
  }
}
