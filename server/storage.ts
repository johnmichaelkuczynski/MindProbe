import { type User, type InsertUser, type AnalysisResult, type InsertAnalysis, type DialogueMessage, type InsertDialogue } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  createAnalysis(analysis: InsertAnalysis): Promise<AnalysisResult>;
  getAnalysis(id: string): Promise<AnalysisResult | undefined>;
  updateAnalysisResults(id: string, results: any, status: string): Promise<void>;
  
  createDialogueMessage(message: InsertDialogue): Promise<DialogueMessage>;
  getDialogueMessages(analysisId: string): Promise<DialogueMessage[]>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private analyses: Map<string, AnalysisResult>;
  private dialogueMessages: Map<string, DialogueMessage>;

  constructor() {
    this.users = new Map();
    this.analyses = new Map();
    this.dialogueMessages = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async createAnalysis(insertAnalysis: InsertAnalysis): Promise<AnalysisResult> {
    const id = randomUUID();
    const analysis: AnalysisResult = {
      ...insertAnalysis,
      id,
      userId: null,
      additionalContext: insertAnalysis.additionalContext || null,
      results: {},
      status: "pending",
      createdAt: new Date(),
      completedAt: null,
    };
    this.analyses.set(id, analysis);
    return analysis;
  }

  async getAnalysis(id: string): Promise<AnalysisResult | undefined> {
    return this.analyses.get(id);
  }

  async updateAnalysisResults(id: string, results: any, status: string): Promise<void> {
    const analysis = this.analyses.get(id);
    if (analysis) {
      analysis.results = results;
      analysis.status = status;
      if (status === "completed") {
        analysis.completedAt = new Date();
      }
      this.analyses.set(id, analysis);
    }
  }

  async createDialogueMessage(insertMessage: InsertDialogue): Promise<DialogueMessage> {
    const id = randomUUID();
    const message: DialogueMessage = {
      ...insertMessage,
      id,
      createdAt: new Date(),
    };
    this.dialogueMessages.set(id, message);
    return message;
  }

  async getDialogueMessages(analysisId: string): Promise<DialogueMessage[]> {
    return Array.from(this.dialogueMessages.values())
      .filter(msg => msg.analysisId === analysisId)
      .sort((a, b) => a.createdAt!.getTime() - b.createdAt!.getTime());
  }
}

export const storage = new MemStorage();
