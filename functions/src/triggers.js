/**
 * Firestore Triggers
 * Handles automatic actions based on database changes.
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const {generateAnalysis} = require("./helpers");
const {matchCareers} = require("./engine/matching");
const logger = require("./logger");

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

// Trigger: On Test Results Update
// Listens for changes in tests_results/{uid}
// Checks if both tests are complete and triggers AI Analysis
exports.onUserTestUpdate = functions.firestore
    .document("tests_results/{uid}")
    .onWrite(async (change, context) => {
      const uid = context.params.uid;
      const newData = change.after.exists ? change.after.data() : null;

      // Unused: const oldData = change.before.exists ? change.before.data() : null;

      if (!newData) return null; // Document deleted

      // Check if status changed or just updated
      const bigFiveCompleted = newData.bigFive?.completed === true;
      const hollandCompleted = newData.holland?.completed === true;

      // If not both complete, do nothing
      if (!bigFiveCompleted || !hollandCompleted) {
        return null;
      }

      // Check if we already have a specialized AI analysis or if it's currently processing
      // We check the 'users/{uid}' doc which tracks the high-level profile status
      const userRef = admin.firestore().collection("users").doc(uid);
      const userSnap = await userRef.get();
      const userData = userSnap.exists ? userSnap.data() : {};

      // Avoid infinite loops or re-runs if already done/processing
      // We only run if aiStatus is NOT 'completed' and NOT 'processing'
      // OR if the tests were JUST completed (timestamp check could be added, but relying on status is safer)
      // However, if a user retakes a test, we might want to re-run.
      // Let's check if the test completion timestamps are newer than the last analysis.

      const lastAnalysisTime = userData.aiLastUpdated ? userData.aiLastUpdated.toMillis() : 0;
      const bigFiveTime = newData.bigFive?.timestamp ? newData.bigFive.timestamp.toMillis() : 0;
      const hollandTime = newData.holland?.timestamp ? newData.holland.timestamp.toMillis() : 0;
      const latestTestTime = Math.max(bigFiveTime, hollandTime);

      // If analysis is fresh enough, skip
      if (userData.aiStatus === "completed" && lastAnalysisTime > latestTestTime) {
        logger.log(`[Trigger] Analysis already up to date for user ${uid}`);
        return null;
      }

      if (userData.aiStatus === "processing") {
        // Check if it's stuck (processing for > 5 mins)
        const now = Date.now();
        const processingStart = userData.aiTriggeredAt ? userData.aiTriggeredAt.toMillis() : 0;
        if (now - processingStart < 5 * 60 * 1000) {
          logger.log(`[Trigger] Analysis already processing for user ${uid}`);
          return null;
        }
        logger.warn(`[Trigger] Analysis stuck in processing for user ${uid}, restarting...`);
      }

      // START ANALYSIS
      logger.log(`[Trigger] Starting AI Analysis for user ${uid}...`);

      // Set status to processing
      await userRef.set({
        aiStatus: "processing",
        aiTriggeredAt: admin.firestore.FieldValue.serverTimestamp(),
      }, {merge: true});

      try {
        // Prepare Data
        const bigFiveResults = newData.bigFive?.result || newData.bigFive;
        const hollandResults = newData.holland?.result || newData.holland;

        // Generate Analysis (Career Matching)
        // This runs the deterministic matching engine + AI explanations
        const aiResult = await generateAnalysis("Career-Match", {
          bigFive: bigFiveResults,
          holland: hollandResults,
        }, userData);

        // Fetch individual analyses if needed, but Career-Match gives the main profile.
        // Requirement: "Personality Analysis" explanation.
        // We might want to call BigFive analysis separately if not included.
        // The generateAnalysis('Career-Match') in helpers.js currently returns structured { topCareers: ... }
        // It does NOT return the personality text.
        // So we should run them in parallel like api.js does.

        const [bfAnalysis, hAnalysis] = await Promise.all([
          generateAnalysis("Big-Five", bigFiveResults, userData),
          generateAnalysis("Holland", hollandResults, userData),
        ]);

        const finalAnalysis = {
          personalityAnalysis: bfAnalysis.personalityAnalysis,
          strengths: bfAnalysis.strengths || [],
          weaknesses: bfAnalysis.weaknesses || [],
          learningRecommendations: bfAnalysis.learningRecommendations || [],
          typeExplanation: hAnalysis.typeExplanation || "",
          topCareers: aiResult.topCareers || [],
          generatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        // Save Result
        await userRef.set({
          aiStatus: "completed",
          aiAnalysis: finalAnalysis,
          aiLastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        }, {merge: true});

        // Log Activity
        await userRef.collection("activityLogs").add({
          action: "AI Career Analysis Completed",
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

        logger.log(`[Trigger] AI Analysis successful for user ${uid}`);
      } catch (error) {
        logger.error(`[Trigger] Analysis failed for user ${uid}:`, error.message);

        await userRef.set({
          aiStatus: "error",
          aiError: error.message,
        }, {merge: true});
      }

      return null;
    });

// Trigger: On Manual Analysis Requested
// Listens for aiStatus === 'processing' and aiSource === 'demo-engine'
exports.onManualAnalysisTrigger = functions.firestore
    .document("users/{uid}")
    .onUpdate(async (change, context) => {
      const uid = context.params.uid;
      const newData = change.after.data();
      const oldData = change.before.data();

      logger.log(`[ManualTrigger] User update: UID=${uid}, ` +
        `status=${newData.aiStatus}, source=${newData.aiSource}`);

      // Trigger: aiStatus changed to 'processing' AND aiSource is 'demo-engine'
      if (newData.aiStatus === "processing" &&
          newData.aiSource === "demo-engine" &&
          oldData.aiStatus !== "processing") {
        logger.log(`[ManualTrigger] START: UID=${uid}`);

        try {
          // 1. Fetch Test Results
          const trDoc = await admin.firestore().collection("tests_results").doc(uid).get();
          logger.log(`[ManualTrigger] trDoc exists: ${trDoc.exists()}`);

          if (!trDoc.exists()) {
            await admin.firestore().collection("users").doc(uid).update({
              aiStatus: "completed",
              aiAnalysis: {
                message: "Tests incomplete - No data found.",
                personalityAnalysis: "Tests incomplete",
                top3Careers: [],
              },
              aiLastUpdated: admin.firestore.FieldValue.serverTimestamp(),
            });
            return null;
          }

          const trData = trDoc.data();
          const bigFiveResults = trData.bigFive?.result || trData.bigFive;
          const hollandResults = trData.holland?.result || trData.holland;

          if (!bigFiveResults || !hollandResults ||
              !trData.bigFive?.completed || !trData.holland?.completed) {
            await admin.firestore().collection("users").doc(uid).update({
              aiStatus: "completed",
              aiAnalysis: {
                message: "Tests incomplete - Please complete both tests first.",
                personalityAnalysis: "Tests incomplete",
                top3Careers: [],
              },
              aiLastUpdated: admin.firestore.FieldValue.serverTimestamp(),
            });
            return null;
          }

          // 2. Generate Deterministic Matches
          const topMatches = matchCareers(bigFiveResults, hollandResults, 3);

          // 3. Construct Analysis Object
          // Template-based personality analysis based on top matches
          const primaryThemes = topMatches.map((m) => m.title.replace("Developer", "").trim()).join(", ");
          const personalityText = `Based on your psychological profile, you exhibit a ` +
            `${topMatches[0].matchLevel.toLowerCase()} with roles like ${topMatches[0].title}. ` +
            "Your results indicate a strong alignment with " +
            `${primaryThemes} domains, rewarding your specific blend of analytical thinking and ` +
            "structured problem-solving. This analysis suggests you would thrive in environments " +
            "that value technical precision and investigative logic.";

          const finalAnalysis = {
            message: "Success",
            personalityAnalysis: personalityText,
            top3Careers: topMatches.map((m) => ({
              title: m.title,
              fit: m.score,
              reason: m.description,
              roadmap: m.details?.roadmap || [],
              salary: m.salary,
              skills: m.skills || [],
            })),
            generatedAt: admin.firestore.FieldValue.serverTimestamp(),
            source: "demo-engine",
          };

          logger.log(`[ManualTrigger] SUCCESS: Generated ${finalAnalysis.top3Careers.length} careers`);

          // 4. Update User Doc
          await admin.firestore().collection("users").doc(uid).update({
            aiStatus: "completed",
            aiAnalysis: finalAnalysis,
            aiLastUpdated: admin.firestore.FieldValue.serverTimestamp(),
          });

          // 5. Log Activity
          await admin.firestore().collection("users").doc(uid).collection("activityLogs").add({
            action: "Deterministic Career Analysis Completed",
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
          });

          logger.log(`[ManualTrigger] Demo-engine analysis successful for user ${uid}`);
        } catch (error) {
          logger.error(`[ManualTrigger] Failed for user ${uid}:`, error.message);
          await admin.firestore().collection("users").doc(uid).update({
            aiStatus: "error",
            aiError: error.message,
          });
        }
      }
      return null;
    });
