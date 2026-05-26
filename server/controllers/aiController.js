const db = require('../data/firebaseDb');
const axios = require('axios');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { OpenAI } = require('openai');
const { getRepoContext } = require('../services/githubService');

// ─────────────────────────────────────────────────────────────────────────────
// DYNAMIC FALLBACK: Generate stack-specific questions based on the tech stack
// string even without an LLM. Returns exactly 10 questions.
// ─────────────────────────────────────────────────────────────────────────────
const QUESTION_BANK = {
    python: [
        { question: "What is the difference between a list and a tuple in Python?", answer: "Lists are mutable (can be changed after creation) and use square brackets. Tuples are immutable (cannot be changed) and use parentheses. Tuples are faster and hashable, so they can be used as dictionary keys. Use tuples for fixed data and lists for collections that may change.", difficulty: "Easy", category: "Python" },
        { question: "Explain Python decorators and where did you use them?", answer: "A decorator is a function that wraps another function to add behavior without modifying its source code. In Python, they use the @decorator syntax. Common examples include @app.route() in Flask to define URL routes, @login_required to protect views, and @staticmethod/@classmethod for class methods.", difficulty: "Medium", category: "Python" },
        { question: "What are Python generators and how are they different from lists?", answer: "Generators produce values lazily using the yield keyword, one at a time, without storing the entire sequence in memory. Lists store all elements in memory at once. Generators are memory-efficient for large datasets. You iterate over them with next() or in a for loop.", difficulty: "Medium", category: "Python" },
        { question: "How does Python's GIL (Global Interpreter Lock) affect multithreading?", answer: "The GIL is a mutex that allows only one thread to execute Python bytecode at a time, even on multi-core CPUs. This means Python threads cannot achieve true parallelism for CPU-bound tasks. For I/O-bound tasks (like network requests), threading is still effective. Use multiprocessing for CPU-bound parallel work.", difficulty: "Hard", category: "Python" },
        { question: "What is the difference between @staticmethod and @classmethod?", answer: "@staticmethod doesn't receive any implicit first argument and behaves like a plain function inside a class. @classmethod receives the class (cls) as the first argument and can access or modify class state. Use @staticmethod for utility functions and @classmethod for factory methods or class-level operations.", difficulty: "Medium", category: "Python" },
    ],
    django: [
        { question: "Explain the Django MVT (Model-View-Template) architecture.", answer: "Django follows MVT: Models define the database schema using Python classes that map to tables. Views contain business logic and handle HTTP requests, returning responses. Templates are HTML files with Django template language for dynamic rendering. This separates concerns — data, logic, and presentation are decoupled.", difficulty: "Easy", category: "Django" },
        { question: "How does Django's ORM handle database queries?", answer: "Django's ORM (Object-Relational Mapper) lets you query the database using Python instead of SQL. Model.objects.all() returns all records, .filter() applies WHERE conditions, .get() returns a single object. The ORM generates optimized SQL behind the scenes and supports lazy evaluation — queries only execute when data is accessed.", difficulty: "Medium", category: "Django" },
        { question: "What is Django middleware and how did you use it?", answer: "Django middleware is a framework of hooks into the request/response processing pipeline. Each middleware processes requests before they reach the view and responses before they're returned to the client. Common examples include AuthenticationMiddleware, SessionMiddleware, and CsrfViewMiddleware. Custom middleware can be added to settings.MIDDLEWARE.", difficulty: "Medium", category: "Django" },
        { question: "How do Django migrations work? What is makemigrations vs migrate?", answer: "Migrations track changes to your Django models and apply them to the database. makemigrations detects model changes and creates migration files (Python scripts). migrate applies those migration files to the database, creating or modifying tables. This allows schema evolution without manually writing SQL.", difficulty: "Easy", category: "Django" },
    ],
    flask: [
        { question: "How does Flask handle routing and request parameters?", answer: "Flask uses @app.route() decorators to bind URL patterns to view functions. URL parameters are captured using angle brackets like /user/<int:id>. Query parameters are accessed via request.args, form data via request.form, and JSON body via request.get_json(). Flask's routing is flexible and supports HTTP method filtering.", difficulty: "Easy", category: "Flask" },
        { question: "What is Flask's application context and request context?", answer: "Flask has two contexts: the application context (holds app-level data like current_app and g) and the request context (holds request-level data like request and session). Contexts are pushed automatically during requests and CLI commands. The g object is used to store data for the duration of a single request.", difficulty: "Hard", category: "Flask" },
        { question: "How did you handle authentication in Flask?", answer: "Authentication in Flask can be handled using Flask-Login for session-based auth or JWT tokens for stateless API auth. Flask-Login provides user_loader, login_user(), logout_user(), and @login_required decorators. For APIs, JWT tokens are verified on each request using a before_request hook or a custom decorator.", difficulty: "Medium", category: "Flask" },
    ],
    fastapi: [
        { question: "What makes FastAPI faster than Flask or Django?", answer: "FastAPI is built on Starlette (ASGI) and uses Python type hints for automatic data validation via Pydantic. It supports async/await natively, enabling non-blocking I/O for high concurrency. It auto-generates OpenAPI/Swagger docs. Flask and Django use WSGI (synchronous), making FastAPI significantly faster for I/O-bound workloads.", difficulty: "Medium", category: "FastAPI" },
        { question: "How do Pydantic models work in FastAPI?", answer: "Pydantic models are Python classes that inherit from BaseModel and use type annotations to define data schemas. FastAPI uses them for request body validation, response serialization, and auto-documentation. When a request comes in, FastAPI automatically validates and parses the body against the Pydantic model, returning 422 if validation fails.", difficulty: "Medium", category: "FastAPI" },
        { question: "How does FastAPI handle dependency injection?", answer: "FastAPI's Depends() system allows injecting reusable logic (like database sessions, authentication checks) into route handlers. You define a dependency function, and FastAPI automatically calls it and passes the result to your route function. This promotes code reuse and separation of concerns without manual wiring.", difficulty: "Hard", category: "FastAPI" },
    ],
    react: [
        { question: "What is the difference between useState and useEffect in React?", answer: "useState manages local component state — it returns a state value and a setter function. When the setter is called, the component re-renders. useEffect handles side effects (API calls, subscriptions, DOM manipulation) after rendering. It accepts a dependency array — if empty, it runs only on mount; if dependencies are listed, it re-runs when they change.", difficulty: "Easy", category: "React" },
        { question: "What is the virtual DOM and how does React use it?", answer: "The virtual DOM is a lightweight in-memory copy of the real DOM. When state changes, React creates a new virtual DOM tree and diffs it against the previous one using a reconciliation algorithm. Only the actual differences are applied to the real DOM, avoiding expensive full re-renders and making updates fast.", difficulty: "Medium", category: "React" },
        { question: "How did you manage state across components in your React project?", answer: "State can be lifted to a common parent component and passed as props. For global state, options include React Context API (useContext hook) for medium-scale apps, or Redux/Zustand for large-scale. In this project, Context was used to share authentication state and user data across pages without prop drilling.", difficulty: "Medium", category: "React" },
    ],
    nodejs: [
        { question: "How does Node.js handle concurrency without multiple threads?", answer: "Node.js uses an event-driven, non-blocking I/O model with a single-threaded event loop. Asynchronous operations (like file reads, database queries) are offloaded to the OS via libuv. When they complete, callbacks are placed in the event queue and executed by the event loop. This allows handling many concurrent connections efficiently.", difficulty: "Medium", category: "Node.js" },
        { question: "What is the difference between require() and ES module import in Node.js?", answer: "require() is CommonJS syntax (Node.js default) — it's synchronous and loads modules at runtime. import is ES Module syntax — it's static and resolved at parse time, enabling tree-shaking. Node.js supports both, but they cannot be freely mixed. ESM uses .mjs files or \"type\": \"module\" in package.json.", difficulty: "Easy", category: "Node.js" },
        { question: "Explain the Express.js middleware pipeline and how errors propagate.", answer: "Express middleware are functions with (req, res, next) signature. They execute sequentially — each middleware calls next() to pass control to the next one. Error-handling middleware has four parameters (err, req, res, next) and is defined last. If any middleware calls next(err), Express skips regular middleware and goes to the error handler.", difficulty: "Medium", category: "Express" },
    ],
    mongodb: [
        { question: "What is the difference between find() and findOne() in MongoDB?", answer: "find() returns a cursor to all documents matching the query — you iterate over them or convert to an array. findOne() returns the first matching document directly (or null). findOne() is more efficient when you only need one result. Both accept query filters and projection options.", difficulty: "Easy", category: "MongoDB" },
        { question: "How does MongoDB indexing improve query performance?", answer: "Without an index, MongoDB performs a collection scan (checking every document). An index stores a sorted copy of a field's values with pointers to documents, enabling fast lookups like a book's index. Creating an index on frequently queried fields (e.g., userId, email) dramatically reduces query time from O(n) to O(log n).", difficulty: "Medium", category: "MongoDB" },
    ],
    mysql: [
        { question: "What is the difference between INNER JOIN, LEFT JOIN, and RIGHT JOIN?", answer: "INNER JOIN returns only rows where there is a match in both tables. LEFT JOIN returns all rows from the left table and matching rows from the right (NULLs for non-matches). RIGHT JOIN is the opposite — all rows from the right table. FULL OUTER JOIN returns all rows from both tables.", difficulty: "Easy", category: "SQL" },
        { question: "What are database transactions and what are ACID properties?", answer: "A transaction is a sequence of operations treated as a single unit. ACID stands for: Atomicity (all operations succeed or all are rolled back), Consistency (data remains valid), Isolation (concurrent transactions don't interfere), Durability (committed changes persist even after failure). Transactions ensure data integrity.", difficulty: "Hard", category: "Database" },
    ],
    jwt: [
        { question: "What are the three parts of a JWT token?", answer: "A JWT has three Base64URL-encoded parts separated by dots: Header (algorithm and token type), Payload (claims — data like user ID, role, expiration), and Signature (HMAC or RSA signature to verify the token wasn't tampered with). Only the signature uses the secret key — the header and payload are readable by anyone.", difficulty: "Easy", category: "Authentication" },
        { question: "What happens when a JWT token expires and how do you handle it?", answer: "When a JWT expires, the server returns a 401 Unauthorized response. The client should detect this status code and either redirect to login or use a refresh token to obtain a new access token. Refresh tokens are longer-lived tokens stored securely (httpOnly cookies) that can generate new access tokens without re-authentication.", difficulty: "Medium", category: "Authentication" },
    ],
    firebase: [
        { question: "How does Firestore structure data differently from a SQL database?", answer: "Firestore is a document-oriented NoSQL database. Data is stored in Collections (like tables) containing Documents (JSON-like objects). Documents can have nested Subcollections. Unlike SQL, there's no fixed schema — each document can have different fields. Firestore scales automatically and supports real-time listeners.", difficulty: "Easy", category: "Firebase" },
        { question: "What is Firebase Authentication and how does it integrate with Firestore security rules?", answer: "Firebase Auth provides authentication via email/password, Google, GitHub, etc. It issues an ID token (JWT) after login. Firestore Security Rules use request.auth to check the authenticated user's UID and claims, allowing fine-grained access control. For example, rules can ensure users can only read/write their own documents.", difficulty: "Medium", category: "Firebase" },
    ],
    general: [
        { question: "What is version control and how did you use Git in this project?", answer: "Version control tracks changes to code over time, allowing collaboration and rollback. Git is a distributed VCS. We used git init, git commit, git push to track changes, feature branches to develop new features, and pull requests for code reviews. GitHub hosted the remote repository.", difficulty: "Easy", category: "Git" },
        { question: "What is the difference between GET and POST HTTP methods?", answer: "GET retrieves data from the server — parameters are sent in the URL, visible in browser history, and are idempotent (same request = same result). POST sends data in the request body — used for creating/updating resources, not cached, and more secure for sensitive data. POST is not idempotent.", difficulty: "Easy", category: "HTTP" },
        { question: "How did you handle errors and exceptions in your project?", answer: "Error handling uses try-catch blocks for synchronous code and .catch() or async/await with try-catch for asynchronous code. HTTP errors are returned with appropriate status codes (400 for bad input, 401 for unauthorized, 404 for not found, 500 for server errors). User-facing messages are kept generic while detailed logs go to the server console.", difficulty: "Medium", category: "Error Handling" },
        { question: "What is the difference between authentication and authorization?", answer: "Authentication verifies WHO you are (e.g., login with email/password, JWT verification). Authorization verifies WHAT you are allowed to do (e.g., only admins can delete records, only the project owner can edit their project). Authentication always comes first — you must know who someone is before checking what they can access.", difficulty: "Easy", category: "Security" },
        { question: "How did you test your application during development?", answer: "Testing can include manual testing (running the app and checking behavior), unit tests (testing individual functions using Jest/pytest/JUnit), integration tests (testing API endpoints with Postman or Supertest), and end-to-end tests. During development, API endpoints were tested using browser DevTools network tab and Postman before frontend integration.", difficulty: "Medium", category: "Testing" },
    ]
};

/**
 * Robust JSON array extractor from a text response that might contain
 * conversational prefix/suffix or markdown blocks.
 */
const extractJsonArray = (text) => {
    if (!text || typeof text !== 'string') return null;
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();

    // Strategy 1: Try parsing directly
    try {
        const direct = JSON.parse(cleaned);
        if (Array.isArray(direct)) return direct;
        if (typeof direct === 'object' && direct !== null) {
            for (const val of Object.values(direct)) {
                if (Array.isArray(val) && val.length > 0) return val;
            }
        }
    } catch (err) {
        // Strategy 1 failed
    }

    // Strategy 2: Try extracting using bracket offsets for array, with truncation recovery
    try {
        const start = cleaned.indexOf('[');
        if (start !== -1) {
            const arrText = cleaned.slice(start);
            const end = arrText.lastIndexOf(']');
            if (end !== -1) {
                try {
                    const parsed = JSON.parse(arrText.slice(0, end + 1));
                    if (Array.isArray(parsed)) return parsed;
                } catch (e) {
                    // direct parse of bracket slice failed, proceed to truncation fix
                }
            }

            // Truncation recovery: find last closing brace of any complete question object
            const lastBrace = arrText.lastIndexOf('}');
            if (lastBrace !== -1) {
                let partial = arrText.slice(0, lastBrace + 1).trim();
                if (partial.endsWith(',')) {
                    partial = partial.slice(0, -1).trim();
                }
                partial += ']';
                try {
                    const parsed = JSON.parse(partial);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        console.log('[Viva] Recovered truncated JSON array of length:', parsed.length);
                        return parsed;
                    }
                } catch (e) {
                    // recovery failed
                }
            }
        }
    } catch (err) {
        // Strategy 2 failed
    }

    // Strategy 3: Try extracting object with brackets
    try {
        const startObj = cleaned.indexOf('{');
        const endObj = cleaned.lastIndexOf('}');
        if (startObj !== -1 && endObj !== -1 && endObj > startObj) {
            const objText = cleaned.slice(startObj, endObj + 1);
            const parsed = JSON.parse(objText);
            for (const val of Object.values(parsed)) {
                if (Array.isArray(val) && val.length > 0) return val;
            }
        }
    } catch (err) {
        // Strategy 3 failed
    }

    console.warn('[Viva] extractJsonArray could not extract array. Sample:', cleaned.slice(0, 150));
    return null;
};

/**
 * Build 10 fallback questions dynamically based on the detected tech stack.
 * Picks relevant questions from QUESTION_BANK by matching stack keywords.
 */
const generateDynamicFallback = (techStack) => {
    const stack = (techStack || '').toLowerCase();
    const selected = [];

    // Map of keyword → bank key
    const keywordMap = [
        { keywords: ['fastapi'], key: 'fastapi' },
        { keywords: ['django'], key: 'django' },
        { keywords: ['flask'], key: 'flask' },
        { keywords: ['python'], key: 'python' },
        { keywords: ['react', 'next.js', 'nextjs'], key: 'react' },
        { keywords: ['node', 'express'], key: 'nodejs' },
        { keywords: ['mongodb', 'mongoose'], key: 'mongodb' },
        { keywords: ['mysql', 'postgresql', 'postgres', 'sqlite', 'sql'], key: 'mysql' },
        { keywords: ['jwt'], key: 'jwt' },
        { keywords: ['firebase', 'firestore'], key: 'firebase' },
    ];

    // Detect which banks are relevant for this stack
    const matchedKeys = [];
    for (const { keywords, key } of keywordMap) {
        if (keywords.some(kw => stack.includes(kw)) && !matchedKeys.includes(key)) {
            matchedKeys.push(key);
        }
    }

    // First: pull ONE question from each matched bank
    const pick = (key) => {
        const bank = QUESTION_BANK[key] || [];
        for (const q of bank) {
            if (!selected.find(s => s.question === q.question)) {
                selected.push(q);
                return;
            }
        }
    };
    for (const key of matchedKeys) pick(key);

    // Second: fill remaining slots by cycling through matched banks (more questions from them)
    const fillKeys = matchedKeys.length > 0 ? matchedKeys : ['general'];
    let pass = 1;
    while (selected.length < 10 && pass < 10) {
        for (const key of fillKeys) {
            if (selected.length >= 10) break;
            const bank = QUESTION_BANK[key] || [];
            const available = bank.filter(q => !selected.find(s => s.question === q.question));
            if (available.length >= pass) {
                selected.push(available[pass - 1]);
            }
        }
        pass++;
    }

    // Third: top-up with general questions if still short
    for (const q of QUESTION_BANK.general) {
        if (selected.length >= 10) break;
        if (!selected.find(s => s.question === q.question)) {
            selected.push(q);
        }
    }

    return selected.slice(0, 10);
};

/**
 * Build exactly 4 fallback questions (1 Easy, 2 Medium, 1 Hard) for a specific member.
 */
const generateMemberFallback = (techStack, member) => {
    const stack = (techStack || '').toLowerCase();
    const selected = [];

    const keywordMap = [
        { keywords: ['fastapi'], key: 'fastapi' },
        { keywords: ['django'], key: 'django' },
        { keywords: ['flask'], key: 'flask' },
        { keywords: ['python'], key: 'python' },
        { keywords: ['react', 'next.js', 'nextjs'], key: 'react' },
        { keywords: ['node', 'express'], key: 'nodejs' },
        { keywords: ['mongodb', 'mongoose'], key: 'mongodb' },
        { keywords: ['mysql', 'postgresql', 'postgres', 'sqlite', 'sql'], key: 'mysql' },
        { keywords: ['jwt'], key: 'jwt' },
        { keywords: ['firebase', 'firestore'], key: 'firebase' },
    ];

    const matchedKeys = [];
    for (const { keywords, key } of keywordMap) {
        if (keywords.some(kw => stack.includes(kw)) && !matchedKeys.includes(key)) {
            matchedKeys.push(key);
        }
    }
    if (matchedKeys.length === 0) matchedKeys.push('general');

    let pool = [];
    matchedKeys.forEach(k => {
        const bank = QUESTION_BANK[k] || [];
        pool.push(...bank);
    });
    pool.push(...QUESTION_BANK.general);

    const easyQ = pool.filter(q => (q.difficulty || '').toLowerCase() === 'easy');
    const medQ = pool.filter(q => (q.difficulty || '').toLowerCase() === 'medium');
    const hardQ = pool.filter(q => (q.difficulty || '').toLowerCase() === 'hard');

    const pickOne = (arr, fallbackDifficulty) => {
        if (arr.length > 0) {
            const idx = Math.floor(Math.random() * arr.length);
            const item = arr.splice(idx, 1)[0];
            return {
                question: item.question,
                answer: item.answer,
                difficulty: item.difficulty,
                category: item.category || 'General',
                assignedTo: member
            };
        }
        const generalPool = QUESTION_BANK.general;
        const fallbackItem = generalPool[Math.floor(Math.random() * generalPool.length)];
        return {
            question: fallbackItem.question,
            answer: fallbackItem.answer,
            difficulty: fallbackDifficulty,
            category: fallbackItem.category || 'General',
            assignedTo: member
        };
    };

    selected.push(pickOne(easyQ, 'Easy'));
    selected.push(pickOne(medQ, 'Medium'));
    selected.push(pickOne(medQ, 'Medium'));
    selected.push(pickOne(hardQ, 'Hard'));

    return selected;
};

const generateViva = async (req, res) => {
    let stack = 'general';
    try {
        const { projectId, projectTitle, techStack, projectDescription, repoLink: bodyRepoLink } = req.body;

        let title = projectTitle;
        stack = techStack || 'general';
        let desc = projectDescription;
        let repoLink = bodyRepoLink;

        let teamMembers = [];
        let pdfText = "";

        // Look up actual project from DB using projectId
        if (projectId) {
            const project = await db.findById('projects', projectId);
            if (project) {
                title = project.title || title;
                stack = project.techStack || stack;
                desc = project.description || desc;
                repoLink = project.repoLink || repoLink;
                pdfText = project.pdfText || "";

                // Extract members
                if (project.leaderName) {
                    teamMembers.push(project.leaderName);
                }
                if (Array.isArray(project.members)) {
                    project.members.forEach(m => {
                        const name = typeof m === 'string' ? m : (m.name || m.studentName);
                        if (name && !teamMembers.includes(name)) {
                            teamMembers.push(name);
                        }
                    });
                }
            }
        }

        // Standardize title and stack
        title = title || "PBL Project";
        stack = stack || "general";
        desc = desc || "A student's project";

        // Fallback team members if none found
        if (teamMembers.length === 0) {
            teamMembers = [req.body.leaderName || "Leader", "Member 1", "Member 2", "Member 3"];
        }

        console.log(`[Viva] Generating questions for stack: "${stack}", team: [${teamMembers.join(', ')}], repo: ${repoLink || 'none'}`);

        // Fetch full repo context (README + requirements.txt / package.json etc.)
        let repoContext = "";
        let detectedFiles = [];
        if (repoLink) {
            try {
                const ctx = await getRepoContext(repoLink);
                repoContext = ctx.summary;
                detectedFiles = ctx.detectedFiles;
                console.log(`[Viva] Fetched repo context — detected files: ${detectedFiles.join(', ') || 'none'}`);
            } catch (err) {
                console.error(`[Viva] Failed to fetch repo context:`, err.message);
            }
        }

        // Build PDF context if available
        let pdfContext = "";
        if (pdfText) {
            pdfContext = `Project PDF Report/Synopsis Template Text:\n"""\n${pdfText.slice(0, 8000)}\n"""`;
            console.log(`[Viva] Injecting PDF context (${pdfText.length} characters)`);
        }

        const provider = (process.env.AI_PROVIDER || 'ollama').toLowerCase();
        let questions = [];

        if (provider === 'openai' || provider === 'gemini') {
            // For cloud-based APIs, we can request all questions in a single prompt
            const prompt = `You are a technical viva examiner.
Project: "${title}"
Tech Stack: ${stack}
Team members: ${teamMembers.join(', ')}
${pdfContext ? `Below is the project's PDF report/synopsis context:\n${pdfContext}\n` : ''}
${repoContext ? `Below is some repository file summary context:\n${repoContext}\n` : ''}

For each team member, generate exactly 4 technical viva questions about the declared tech stack, their repository files, and the details in their PDF report/synopsis template:
- 1 Easy question
- 2 Medium questions
- 1 Hard question

Return ONLY a valid JSON array of objects. Each object must have:
"question" (string, direct and under 20 words), "answer" (string, concise 1-2 sentences), "difficulty" ("Easy"/"Medium"/"Hard"), "category" (technology name), "assignedTo" (string, name of the member)

Return ONLY the raw JSON array. No markdown, no explanation.`;

            let responseText = "";
            if (provider === 'openai') {
                const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
                const completion = await openai.chat.completions.create({
                    model: "gpt-4o-mini",
                    messages: [
                        { role: "system", content: "You are a JSON generator." },
                        { role: "user", content: prompt }
                    ],
                    response_format: { type: "json_object" }
                });
                responseText = completion.choices[0].message.content;
            } else {
                const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
                const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
                const result = await model.generateContent(prompt);
                const response = await result.response;
                responseText = response.text();
            }

            questions = extractJsonArray(responseText) || [];
            console.log(`[Viva] ${provider} parsed questions:`, questions.length);

        } else {
            // Default to Ollama.
            const ollamaUrl = process.env.OLLAMA_API_URL || 'http://localhost:11434';
            const modelName = process.env.OLLAMA_MODEL || 'llama3.2';

            const callOllama = async (promptText) => {
                const r = await axios.post(`${ollamaUrl}/api/generate`, {
                    model: modelName,
                    prompt: promptText,
                    stream: false,
                    options: { temperature: 0.7, num_predict: 1500 }
                }, { timeout: 60000 });
                return r.data?.response || '';
            };

            console.log(`[Viva] Requesting combined Ollama questions for: [${teamMembers.join(', ')}]`);
            const combinedPrompt = `You are a technical viva examiner.
Project: "${title}"
Tech Stack: ${stack}
Team members: ${teamMembers.join(', ')}
${pdfContext ? `Below is the project's PDF report/synopsis context:\n${pdfContext}\n` : ''}
${repoContext ? `Below is some repository file summary context:\n${repoContext}\n` : ''}

Generate exactly 4 technical questions for each team member (names: ${teamMembers.join(', ')}) about their project, their repository, and the details in their PDF report/synopsis.
Each member's 4 questions must have:
- 1 Easy question
- 2 Medium questions
- 1 Hard question

Return ONLY a valid JSON array of objects. Each object must have:
"question" (string, under 20 words), "answer" (concise 1-2 sentences), "difficulty" ("Easy", "Medium", or "Hard"), "category" (technology name), "assignedTo" (name of the member)

Return ONLY the raw JSON array. No markdown, no explanation.`;

            try {
                const responseText = await callOllama(combinedPrompt);
                const parsed = extractJsonArray(responseText) || [];
                if (parsed.length > 0) {
                    questions = parsed.map(q => ({
                        question: q.question || "Explain a key concept from your project.",
                        answer: q.answer || "Listen for accuracy and understanding.",
                        difficulty: q.difficulty || "Medium",
                        category: q.category || stack,
                        assignedTo: q.assignedTo || teamMembers[0]
                    }));
                    console.log(`[Viva] Combined Ollama generated questions:`, questions.length);
                } else {
                    throw new Error("Could not parse JSON array from Ollama");
                }
            } catch (err) {
                console.warn(`[Viva] Combined Ollama generation failed, falling back to member loop:`, err.message);
                
                // Fallback: sequential calls for each member
                for (const member of teamMembers) {
                    console.log(`[Viva] Fallback requesting Ollama questions for: ${member}`);
                    const memberPrompt = `You are a technical viva examiner.
Student Name: ${member}
Project: "${title}"
Tech Stack: ${stack}
${pdfContext ? `Below is the project's PDF report/synopsis context:\n${pdfContext}\n` : ''}

Generate exactly 4 technical questions for ${member} about their project and tech stack:
- 1 Easy question
- 2 Medium questions
- 1 Hard question

Return ONLY a valid JSON array of exactly 4 objects. Each must have:
"question" (string, under 20 words), "answer" (1-2 concise sentences), "difficulty" ("Easy", "Medium", or "Hard"), "category" (technology name)

Return ONLY the raw JSON array. No markdown, no explanation.`;

                    try {
                        const responseText = await callOllama(memberPrompt);
                        const parsed = extractJsonArray(responseText) || [];
                        if (parsed.length > 0) {
                            const validated = parsed.map(q => ({
                                question: q.question || "Explain a key concept from your project.",
                                answer: q.answer || "Listen for accuracy and understanding.",
                                difficulty: q.difficulty || "Medium",
                                category: q.category || stack,
                                assignedTo: member
                            }));
                            questions.push(...validated);
                        } else {
                            throw new Error("Could not parse JSON array");
                        }
                    } catch (memberErr) {
                        console.warn(`[Viva] Fallback Ollama generation failed for ${member}:`, memberErr.message);
                        const fallbacks = generateMemberFallback(stack, member);
                        questions.push(...fallbacks);
                    }
                }
            }
        }

        // Validate final questions list
        if (questions.length === 0) {
            throw new Error("Empty or invalid questions array from AI providers");
        }

        const finalQuestions = questions.map(q => {
            return {
                question: q.question || "Explain a key concept from your project.",
                answer: q.answer || "Listen for accuracy, understanding, and application of knowledge.",
                difficulty: q.difficulty || "Medium",
                category: q.category || stack,
                assignedTo: q.assignedTo || "General Student"
            };
        });

        res.json({ questions: finalQuestions });

    } catch (error) {
        console.error("[Viva] Main controller error, using complete team fallback:", error.message);
        // Build fallbacks for all team members
        const fallbackQuestions = [];
        const { projectId } = req.body;
        let teamMembers = [req.body.leaderName || "Leader", "Member 1", "Member 2", "Member 3"];

        try {
            if (projectId) {
                const project = await db.findById('projects', projectId);
                if (project) {
                    const list = [];
                    if (project.leaderName) list.push(project.leaderName);
                    if (Array.isArray(project.members)) {
                        project.members.forEach(m => {
                            const name = typeof m === 'string' ? m : (m.name || m.studentName);
                            if (name && !list.includes(name)) list.push(name);
                        });
                    }
                    if (list.length > 0) teamMembers = list;
                }
            }
        } catch (e) {}

        teamMembers.forEach(member => {
            fallbackQuestions.push(...generateMemberFallback(stack, member));
        });

        res.json({ questions: fallbackQuestions });
    }
};

module.exports = { generateViva };
