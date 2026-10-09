let mappings = [];
let jsonLoaded = false;
let jsonError = false;
let classifier;
let currentLabel = "Waiting for classification...";
let currentConfidence = 0;
let video;
let currentRecord = null;


function preload() {
  mappings = loadJSON("finalImageNetLabelsAndEmojis.json", jsonLoadedSuccessfully, jsonFailedToLoad);
}

function jsonLoadedSuccessfully(data) {
  mappings = data;
  jsonLoaded = true;
}

function jsonFailedToLoad(error) {
  console.error("Could not load JSON:", error);
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
  return String(labelText).toLowerCase().trim();
}

function firstTerm(labelText) {
  return normalizeLabel(labelText).split(",")[0].trim();
}

function labelTerms(labelText) {
  return normalizeLabel(labelText)
    .split(",")
    .map(function (term) { return term.trim(); })
    .filter(function (term) { return term.length > 0; });
}

function findMapping(modelLabel) {
  if (!jsonLoaded || !Array.isArray(mappings)) return null;
  let modelFull = normalizeLabel(modelLabel);
  let modelFirst = firstTerm(modelLabel);
  let modelTerms = labelTerms(modelLabel);

  // PASS 1: exact full-label match
  for (let item of mappings) {
    if (!item || !item.label) continue;
    if (modelFull === normalizeLabel(item.label)) return item;
  }

  // PASS 2: first-term match
  for (let item of mappings) {
    if (!item || !item.label) continue;
    if (modelFirst === firstTerm(item.label)) return item;
  }

  // PASS 3: any synonym matches exactly
  for (let item of mappings) {
    if (!item || !item.label) continue;
    let datasetTerms = labelTerms(item.label);
    for (let modelTerm of modelTerms) {
      for (let datasetTerm of datasetTerms) {
        if (modelTerm === datasetTerm) return item;
      }
    }
  }

  // PASS 4: one term contains the other (4+ letters only)
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

function draw() {
  image(video, 0, 0, width, height);
  fill(0, 190); noStroke(); rect(20, 20, 600, 170, 12);
  fill(255); textSize(18); textAlign(LEFT, TOP);
  text("Model label: " + currentLabel, 40, 40);
  text("Confidence: " + nf(currentConfidence * 100, 2, 1) + "%", 40, 70);
  if (jsonError) text("JSON: failed to load", 40, 100);
  else if (!jsonLoaded) text("JSON: loading...", 40, 100);
  else text("JSON records loaded: " + mappings.length, 40, 100);

  if (currentRecord) {
    fill(255);
    text("Category: " + currentRecord.workshopCategory + "  " + currentRecord.emoji, 40, 130);
  } else {
    fill(255, 150, 150);
    text("No match: Unknown ❓", 40, 130);
  }
}

function gotResults(results) {
  if (!results || results.length === 0) return;
  currentLabel = results[0].label;
  currentConfidence = results[0].confidence;
  currentRecord = findMapping(currentLabel);
}
