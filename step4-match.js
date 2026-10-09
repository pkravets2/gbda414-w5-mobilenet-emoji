/*
WEEK 5 WORKSHOP: MISRECOGNITION MIRROR

Steps 1–3 created two separate systems:

webcam -> MobileNet -> label
JSON file -> ImageNet translation records

Step 4 connects them:

MobileNet label -> JSON record -> workshop category -> emoji

The matching process uses several passes, from stricter to more flexible:
1. exact full-label match;
2. first-term match;
3. exact match between comma-separated synonym terms; and
4. careful containment matching for terms of at least four characters.

A missing match remains visible. The program does not pretend that every
MobileNet prediction has a perfect emoji translation. The model prediction,
the data record, and the human-designed interpretation are separate layers.
*/

let video; // Live webcam video.
let classifier; // ml5.js MobileNet classifier.
let mappings = []; // Records loaded from the JSON file.
let currentLabel = "Waiting for classification..."; // Latest model label.
let currentConfidence = 0; // Confidence from 0 to 1.
let currentRecord = null; // Matching JSON record, if found.
let jsonLoaded = false; // Whether JSON loading succeeded.
let jsonError = false; // Whether JSON loading failed.

function preload() {
  // p5 waits for the dataset before setup().
  mappings = loadJSON("finalImageNetLabelsAndEmojis.json", jsonLoadedSuccessfully, jsonFailedToLoad);
}

function jsonLoadedSuccessfully(data) {
  // Store the loaded records.
  mappings = data;
  jsonLoaded = true;
}

function jsonFailedToLoad(error) {
  // An empty array allows the interface to show failure without crashing.
  console.error("Could not load JSON dataset:", error);
  jsonError = true;
  mappings = [];
}

function setup() {
  createCanvas(960, 720);
  video = createCapture(VIDEO, { flipped: true });
  video.size(width, height);
  video.hide();
  classifier = ml5.imageClassifier("MobileNet", { flipped: true });
  classifier.classifyStart(video, gotResults);
}

function normalizeLabel(labelText) {
  // Lowercase and trim a label so comparisons are less sensitive to formatting.
  return String(labelText).toLowerCase().trim();
}

function firstTerm(labelText) {
  // Keep the first term from a comma-separated synonym list.
  return normalizeLabel(labelText).split(",")[0].trim();
}

function labelTerms(labelText) {
  // Turn a comma-separated label into clean, searchable terms.
  return normalizeLabel(labelText)
    .split(",")
    .map(function (term) {
      return term.trim();
    })
    .filter(function (term) {
      return term.length > 0;
    });
}

function findMapping(modelLabel) {
  // Do not search until the JSON has loaded.
  if (!jsonLoaded || !Array.isArray(mappings)) return null;
  let modelFull = normalizeLabel(modelLabel);
  let modelFirst = firstTerm(modelLabel);
  let modelTerms = labelTerms(modelLabel);

  // PASS 1: exact full-label match.
  for (let item of mappings) {
    if (!item || !item.label) continue;
    if (modelFull === normalizeLabel(item.label)) return item;
  }

  // PASS 2: first-term match.
  for (let item of mappings) {
    if (!item || !item.label) continue;
    if (modelFirst === firstTerm(item.label)) return item;
  }

  // PASS 3: exact synonym-term match.
  for (let item of mappings) {
    if (!item || !item.label) continue;
    let datasetTerms = labelTerms(item.label);
    for (let modelTerm of modelTerms) {
      for (let datasetTerm of datasetTerms) {
        if (modelTerm === datasetTerm) return item;
      }
    }
  }

  // PASS 4: containment match, restricted to terms of four or more characters.
  for (let item of mappings) {
    if (!item || !item.label) continue;
    let datasetTerms = labelTerms(item.label);
    for (let modelTerm of modelTerms) {
      for (let datasetTerm of datasetTerms) {
        if (modelTerm.length < 4 || datasetTerm.length < 4) continue;
        if (modelTerm.includes(datasetTerm) || datasetTerm.includes(modelTerm)) return item;
      }
    }
  }
  console.log("No mapping found for:", modelLabel);
  return null;
}

function gotResults(results) {
  // Store the latest prediction and search the JSON for its translation.
  if (!results || results.length === 0) return;
  currentLabel = results[0].label;
  currentConfidence = results[0].confidence;
  currentRecord = findMapping(currentLabel);
  console.log("MobileNet label:", currentLabel);
  console.log("Confidence:", currentConfidence);
  console.log("Matching record:", currentRecord);
}

function draw() {
  // Draw the webcam and then the information panel.
  image(video, 0, 0, width, height);
  fill(0, 190);
  noStroke();
  rect(20, 20, 820, 300, 12);
  fill(255);
  textAlign(LEFT, TOP);
  textSize(18);
  text("STEP 4: MATCH THE MOBILENET LABEL", 40, 42);
  text("Model label: " + currentLabel, 40, 82);
  text("Confidence: " + nf(currentConfidence * 100, 2, 1) + "%", 40, 115);
  if (jsonError) {
    fill(255, 100, 100);
    text("JSON: could not be loaded.", 40, 155);
  } else if (!jsonLoaded) {
    fill(255, 220, 120);
    text("JSON: still loading...", 40, 155);
  } else {
    fill(180, 255, 180);
    text("JSON records loaded: " + mappings.length, 40, 155);
    fill(255);
    if (currentRecord) {
      text("Workshop category: " + currentRecord.workshopCategory, 40, 205);
      text("Emoji: " + currentRecord.emoji, 40, 245);
      text("Match source: " + currentRecord.label, 40, 280);
    } else {
      fill(255, 150, 150);
      text("No matching JSON record found.", 40, 205);
      text("Emoji: ❓", 40, 245);
    }
  }
}
