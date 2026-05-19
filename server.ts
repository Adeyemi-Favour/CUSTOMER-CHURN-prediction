import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, SchemaType } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Secure API Route for Churn Prediction
  app.post("/api/predict", async (req, res) => {
    try {
      const { customer } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        return res.status(500).json({ error: "Gemini API key is not configured on the server." });
      }

      const genAI = new GoogleGenAI(apiKey);
      const model = genAI.getGenerativeModel({ 
        model: "gemini-2.0-flash-exp",
        systemInstruction: "You are an expert Data Scientist and Behavioral Psychologist. Provide your analysis in a structured JSON format."
      });

      const prompt = `
        Analyze this customer data for churn risk.
        Customer Name/Alias: ${customer.fullName}
        Age: ${customer.age}
        State: ${customer.state}
        Device Category: ${customer.device}
        Current Satisfaction: ${customer.satisfactionRate}/5
        Sentiment: "${customer.customerReview}"
        Tenure: ${customer.tenureMonths} months
        Plan Type: ${customer.subscriptionPlan}
        Purchase Frequency: ${customer.purchasesCount}
        LTV (Revenue): ₦${customer.totalRevenue}
        Recent Data Usage: ${customer.dataUsage}GB

        Predict churn risk and provide a detailed diagnostic report.
        Include:
        1. A risk score (0-100).
        2. A persona name for this customer.
        3. Exactly 3 factors with explicit explanations of why they impact risk.
        4. A summary of the "Hidden Risk".
        5. A concrete retention strategy.
      `;

      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: SchemaType.OBJECT,
            properties: {
              riskScore: { type: SchemaType.NUMBER },
              riskLevel: { type: SchemaType.STRING, enum: ["Low", "Medium", "High", "Critical"] },
              behavioralPersona: { type: SchemaType.STRING },
              topFactors: { 
                type: SchemaType.ARRAY, 
                items: { 
                  type: SchemaType.OBJECT,
                  properties: {
                    factor: { type: SchemaType.STRING },
                    impact: { type: SchemaType.STRING, enum: ["Positive", "Negative"] },
                    explanation: { type: SchemaType.STRING }
                  }
                } 
              },
              retentionStrategy: { type: SchemaType.STRING },
              summary: { type: SchemaType.STRING }
            },
            required: ["riskScore", "riskLevel", "behavioralPersona", "topFactors", "retentionStrategy", "summary"]
          }
        }
      });

      const responseText = result.response.text();
      res.json(JSON.parse(responseText));
    } catch (error) {
      console.error("Prediction Error:", error);
      res.status(500).json({ error: "Failed to generate prediction logic." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
