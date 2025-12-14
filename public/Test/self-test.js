/**
 * Self-Test Mode for Client QA
 * Runs full end-to-end test flow automatically
 * Visible on localhost or with ?selftest=true parameter
 */

// Initialize Self-Test button if conditions are met
if (window.location.search.includes('selftest=true') || window.location.hostname === 'localhost') {
    const selfTestBtn = document.createElement('button');
    selfTestBtn.id = 'selfTestBtn';
    selfTestBtn.innerHTML = '🧪 Self-Test (QA Mode)';
    selfTestBtn.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 10000;
        padding: 1rem 1.5rem;
        background: linear-gradient(135deg, #ff6b6b, #ee5a6f);
        color: white;
        border: none;
        border-radius: 8px;
        font-weight: bold;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(255, 107, 107, 0.4);
        font-size: 1rem;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
    `;
    
    // Add hover effect
    selfTestBtn.addEventListener('mouseenter', () => {
        selfTestBtn.style.transform = 'scale(1.05)';
        selfTestBtn.style.boxShadow = '0 6px 16px rgba(255, 107, 107, 0.6)';
    });
    
    selfTestBtn.addEventListener('mouseleave', () => {
        selfTestBtn.style.transform = 'scale(1)';
        selfTestBtn.style.boxShadow = '0 4px 12px rgba(255, 107, 107, 0.4)';
    });
    
    selfTestBtn.onclick = runSelfTest;
    document.body.appendChild(selfTestBtn);
}

/**
 * Run Self-Test - Full end-to-end test flow
 */
async function runSelfTest() {
    const btn = document.getElementById('selfTestBtn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '⏳ Running Self-Test...';
    }
    
    console.log('🧪 Starting Self-Test...');
    const results = {
        bigfive: null,
        holland: null,
        analysis: null
    };
    
    try {
        // Get backend URL
        const apiBaseUrl = window.CONFIG?.API_BASE_URL || 
                          (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                          ? 'http://localhost:5000/api'
                          : (window.CONFIG?.BACKEND_URL ? `${window.CONFIG.BACKEND_URL}/api` : '/api');
        
        // 1. Fetch Big Five questions
        console.log('📋 Step 1: Fetching Big Five questions...');
        const bigFiveRes = await fetch(`${apiBaseUrl}/tests/bigfive`);
        if (!bigFiveRes.ok) {
            const errorText = await bigFiveRes.text();
            throw new Error(`Failed to fetch Big Five questions: ${bigFiveRes.status} ${errorText}`);
        }
        const bigFiveData = await bigFiveRes.json();
        const bigFiveQuestions = bigFiveData.questions || bigFiveData;
        console.log(`✅ Loaded ${bigFiveQuestions.length} Big Five questions`);
        
        // 2. Simulate Big Five answers (middle scores)
        console.log('📝 Step 2: Simulating Big Five answers...');
        const bigFiveAnswers = {};
        bigFiveQuestions.forEach((q, idx) => {
            bigFiveAnswers[q.id] = 2; // Middle score (0-4 scale)
        });
        
        // Calculate Big Five scores (simplified - in real app, this would use proper scoring)
        const bigFiveResult = {
            Openness: 50,
            Conscientiousness: 50,
            Extraversion: 50,
            Agreeableness: 50,
            Neuroticism: 50
        };
        
        // 3. Save Big Five results
        console.log('💾 Step 3: Saving Big Five results...');
        const saveBigFiveRes = await fetch(`${apiBaseUrl}/save-test`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: 'selftest-user',
                testName: 'bigfive-selftest',
                resultData: {
                    result: bigFiveResult,
                    answers: bigFiveAnswers,
                    completedAt: new Date().toISOString()
                }
            })
        });
        if (!saveBigFiveRes.ok) {
            const errorText = await saveBigFiveRes.text();
            throw new Error(`Failed to save Big Five results: ${saveBigFiveRes.status} ${errorText}`);
        }
        results.bigfive = await saveBigFiveRes.json();
        console.log('✅ Big Five results saved:', results.bigfive);
        
        // 4. Fetch Holland questions
        console.log('📋 Step 4: Fetching Holland questions...');
        const hollandRes = await fetch(`${apiBaseUrl}/tests/holland`);
        if (!hollandRes.ok) {
            const errorText = await hollandRes.text();
            throw new Error(`Failed to fetch Holland questions: ${hollandRes.status} ${errorText}`);
        }
        const hollandData = await hollandRes.json();
        const hollandQuestions = hollandData.questions || hollandData;
        console.log(`✅ Loaded ${hollandQuestions.length} Holland questions`);
        
        // 5. Simulate Holland answers
        console.log('📝 Step 5: Simulating Holland answers...');
        const hollandAnswers = {};
        hollandQuestions.forEach((q, idx) => {
            hollandAnswers[q.id] = 3; // Middle score (1-5 scale)
        });
        
        // Calculate Holland scores (simplified - in real app, this would use proper scoring)
        const hollandResult = {
            R: 30, I: 30, A: 30, S: 30, E: 30, C: 30
        };
        
        // 6. Save Holland results
        console.log('💾 Step 6: Saving Holland results...');
        const saveHollandRes = await fetch(`${apiBaseUrl}/save-test`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: 'selftest-user',
                testName: 'holland-selftest',
                resultData: {
                    result: hollandResult,
                    answers: hollandAnswers,
                    completedAt: new Date().toISOString()
                }
            })
        });
        if (!saveHollandRes.ok) {
            const errorText = await saveHollandRes.text();
            throw new Error(`Failed to save Holland results: ${saveHollandRes.status} ${errorText}`);
        }
        results.holland = await saveHollandRes.json();
        console.log('✅ Holland results saved:', results.holland);
        
        // 7. Trigger Gemini analysis
        console.log('🤖 Step 7: Triggering Gemini analysis...');
        const analysisRes = await fetch(`${apiBaseUrl}/analyze-with-gemini`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: 'selftest-user',
                combinedResults: {
                    bigfive: bigFiveResult,
                    holland: hollandResult
                }
            })
        });
        if (!analysisRes.ok) {
            const errorText = await analysisRes.text();
            throw new Error(`Failed to trigger Gemini analysis: ${analysisRes.status} ${errorText}`);
        }
        results.analysis = await analysisRes.json();
        console.log('✅ Gemini analysis complete:', results.analysis);
        
        // 8. Display results
        console.log('📊 Self-Test Results:', results);
        alert(`✅ Self-Test Complete!\n\nBig Five: Saved\nHolland: Saved\nGemini Analysis: Complete\n\nCheck console for full results.`);
        
        // Display in a modal
        displaySelfTestResults(results);
        
    } catch (error) {
        console.error('❌ Self-Test Error:', error);
        alert(`❌ Self-Test Failed: ${error.message}\n\nCheck console for details.`);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '🧪 Self-Test (QA Mode)';
        }
    }
}

/**
 * Display Self-Test results in a modal
 */
function displaySelfTestResults(results) {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        z-index: 100000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem;
    `;
    
    const content = document.createElement('div');
    content.style.cssText = `
        background: #1a1a1a;
        color: white;
        padding: 2rem;
        border-radius: 12px;
        max-width: 800px;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    `;
    
    content.innerHTML = `
        <h2 style="color: #D4AF37; margin-bottom: 1rem; font-size: 1.8rem;">🧪 Self-Test Results</h2>
        <div style="margin-bottom: 1.5rem;">
            <h3 style="color: #4CAF50; margin-bottom: 0.5rem;">✅ Big Five Test</h3>
            <pre style="background: #0a0a0a; padding: 1rem; border-radius: 8px; overflow-x: auto; font-size: 0.9rem; border: 1px solid #333;">${JSON.stringify(results.bigfive, null, 2)}</pre>
        </div>
        <div style="margin-bottom: 1.5rem;">
            <h3 style="color: #4CAF50; margin-bottom: 0.5rem;">✅ Holland Test</h3>
            <pre style="background: #0a0a0a; padding: 1rem; border-radius: 8px; overflow-x: auto; font-size: 0.9rem; border: 1px solid #333;">${JSON.stringify(results.holland, null, 2)}</pre>
        </div>
        <div style="margin-bottom: 1.5rem;">
            <h3 style="color: #2196F3; margin-bottom: 0.5rem;">🤖 Gemini Analysis</h3>
            <pre style="background: #0a0a0a; padding: 1rem; border-radius: 8px; overflow-x: auto; font-size: 0.9rem; border: 1px solid #333;">${JSON.stringify(results.analysis, null, 2)}</pre>
        </div>
        <button onclick="this.closest('div').parentElement.remove()" style="
            padding: 0.75rem 1.5rem;
            background: #D4AF37;
            color: #000;
            border: none;
            border-radius: 8px;
            font-weight: bold;
            cursor: pointer;
            margin-top: 1rem;
            transition: background 0.2s ease;
        " onmouseover="this.style.background='#f4d03f'" onmouseout="this.style.background='#D4AF37'">Close</button>
    `;
    
    modal.appendChild(content);
    document.body.appendChild(modal);
    
    // Close on outside click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

