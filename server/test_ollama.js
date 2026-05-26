const axios = require('axios');

const extractJsonArray = (text) => {
    if (!text || typeof text !== 'string') return null;
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();

    try {
        const direct = JSON.parse(cleaned);
        if (Array.isArray(direct)) return direct;
        if (typeof direct === 'object' && direct !== null) {
            for (const val of Object.values(direct)) {
                if (Array.isArray(val) && val.length > 0) return val;
            }
        }
    } catch (err) {}

    try {
        const start = cleaned.indexOf('[');
        if (start !== -1) {
            const arrText = cleaned.slice(start);
            const end = arrText.lastIndexOf(']');
            if (end !== -1) {
                try {
                    const parsed = JSON.parse(arrText.slice(0, end + 1));
                    if (Array.isArray(parsed)) return parsed;
                } catch (e) {}
            }
        }
    } catch (err) {}

    return null;
};

const run = async () => {
    const ollamaUrl = 'http://localhost:11434';
    const modelName = 'llama3.2:latest';
    const teamMembers = ["Shobhit", "Amit", "Rahul"];
    const title = "AuditX PBL Evaluation System";
    const stack = "React, TailwindCSS, Node.js, Express, Firebase";

    const prompt = `You are a technical viva examiner.
Project: "${title}"
Tech Stack: ${stack}
Team members: ${teamMembers.join(', ')}

For each team member, generate exactly 4 technical viva questions about the declared tech stack:
- 1 Easy question
- 2 Medium questions
- 1 Hard question

Return ONLY a valid JSON array of objects. Each object must have:
"question" (string, direct and under 20 words), "answer" (string, concise 1-2 sentences), "difficulty" ("Easy"/"Medium"/"Hard"), "category" (technology name), "assignedTo" (string, name of the member)

Return ONLY the raw JSON array. No markdown, no explanation.`;

    console.log("Calling Ollama (Single Prompt)...");
    const startTime = Date.now();
    try {
        const r = await axios.post(`${ollamaUrl}/api/generate`, {
            model: modelName,
            prompt: prompt,
            stream: false,
            options: { temperature: 0.7, num_predict: 2000 }
        }, { timeout: 120000 });
        
        const responseText = r.data?.response || '';
        console.log(`Ollama responded in ${((Date.now() - startTime) / 1000).toFixed(2)}s`);
        console.log("Ollama Response Raw Content:\n", responseText);
        
        const parsed = extractJsonArray(responseText);
        console.log("Parsed Result (length = " + (parsed ? parsed.length : 0) + "):\n", parsed);
    } catch (err) {
        console.error("Ollama Error:", err.message);
    }
};

run();
