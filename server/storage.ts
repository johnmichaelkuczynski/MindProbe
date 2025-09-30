import { 
  users, 
  analysisResults, 
  dialogueMessages, 
  creditPurchases,
  type User, 
  type InsertUser, 
  type AnalysisResult, 
  type InsertAnalysis, 
  type DialogueMessage, 
  type InsertDialogue,
  type CreditPurchase,
  type InsertCreditPurchase
} from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserCredits(userId: string, credits: number): Promise<void>;
  deductCredits(userId: string, amount: number): Promise<boolean>;
  
  createAnalysis(analysis: InsertAnalysis & { userId?: string | null }): Promise<AnalysisResult>;
  getAnalysis(id: string): Promise<AnalysisResult | undefined>;
  updateAnalysisResults(id: string, results: any, status: string): Promise<void>;
  
  createDialogueMessage(message: InsertDialogue): Promise<DialogueMessage>;
  getDialogueMessages(analysisId: string): Promise<DialogueMessage[]>;
  
  createCreditPurchase(purchase: InsertCreditPurchase): Promise<CreditPurchase>;
  updateCreditPurchaseStatus(sessionId: string, status: string, paymentIntentId?: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUserCredits(userId: string, credits: number): Promise<void> {
    await db
      .update(users)
      .set({ credits })
      .where(eq(users.id, userId));
  }

  async deductCredits(userId: string, amount: number): Promise<boolean> {
    const user = await this.getUser(userId);
    if (!user) return false;
    
    if (user.isUnlimited) return true;
    
    if (user.credits < amount) return false;
    
    await db
      .update(users)
      .set({ credits: user.credits - amount })
      .where(eq(users.id, userId));
    
    return true;
  }

  async createAnalysis(insertAnalysis: InsertAnalysis & { userId?: string | null }): Promise<AnalysisResult> {
    const [analysis] = await db
      .insert(analysisResults)
      .values({
        ...insertAnalysis,
        userId: insertAnalysis.userId || null,
        results: {},
        status: "pending",
      })
      .returning();
    return analysis;
  }

  async getAnalysis(id: string): Promise<AnalysisResult | undefined> {
    const [analysis] = await db.select().from(analysisResults).where(eq(analysisResults.id, id));
    return analysis || undefined;
  }

  async updateAnalysisResults(id: string, results: any, status: string): Promise<void> {
    const updates: any = { results, status };
    if (status === "completed") {
      updates.completedAt = new Date();
    }
    
    await db
      .update(analysisResults)
      .set(updates)
      .where(eq(analysisResults.id, id));
  }

  async createDialogueMessage(insertMessage: InsertDialogue): Promise<DialogueMessage> {
    const [message] = await db
      .insert(dialogueMessages)
      .values(insertMessage)
      .returning();
    return message;
  }

  async getDialogueMessages(analysisId: string): Promise<DialogueMessage[]> {
    const messages = await db
      .select()
      .from(dialogueMessages)
      .where(eq(dialogueMessages.analysisId, analysisId));
    return messages.sort((a, b) => a.createdAt!.getTime() - b.createdAt!.getTime());
  }

  async createCreditPurchase(purchase: InsertCreditPurchase): Promise<CreditPurchase> {
    const [creditPurchase] = await db
      .insert(creditPurchases)
      .values(purchase)
      .returning();
    return creditPurchase;
  }

  async updateCreditPurchaseStatus(sessionId: string, status: string, paymentIntentId?: string): Promise<void> {
    const updates: any = { status };
    if (status === "completed") {
      updates.completedAt = new Date();
    }
    if (paymentIntentId) {
      updates.stripePaymentIntentId = paymentIntentId;
    }
    
    await db
      .update(creditPurchases)
      .set(updates)
      .where(eq(creditPurchases.stripeSessionId, sessionId));
  }
}

export const storage = new DatabaseStorage();
