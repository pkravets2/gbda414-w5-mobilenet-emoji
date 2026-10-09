let mappings = [];
let jsonLoaded = false;
let jsonError = false;
let classifier;
let currentLabel = "Waiting for classification...";
let currentConfidence = 0;
let video;
let currentRecord = null;
// Memory system
let history = [];             // remembered results
let lastRecordedKey = "";     // last category remembered
let lastRecordTime = 0;       // when it was remembered (ms)
const MAX_MEMORIES = 60;      // cap so it doesn't slow down
const MIN_CONFIDENCE = 0.25;  // ignore very unsure guesses
const COOLDOWN_MS = 1500;     // at most one memory every 1.5s


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
  let btn = createButton("Clear memory");
  btn.mousePressed(function () { history = []; });
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
  drawMemories();
  drawMainEmoji();
  drawPanel();
}

// Info panel: shows the three layers of translation separately
function drawPanel() {
  fill(0, 190); noStroke(); rect(20, 20, 620, 230, 12);
  textAlign(LEFT, TOP); textSize(16);

  // Layer 1: what the model predicted
  fill(150, 200, 255); text("MODEL SAYS", 40, 35);
  fill(255);
  text("Label: " + currentLabel, 40, 57);
  text("Confidence: " + nf(currentConfidence * 100, 2, 1) + "%", 40, 79);

  // Layer 2: what the JSON dataset says about that label
  fill(150, 255, 180); text("DATASET SAYS", 40, 110);
  if (jsonError) {
    fill(255, 120, 120); text("JSON failed to load", 40, 132);
  } else if (!jsonLoaded) {
    fill(255, 220, 120); text("JSON loading...", 40, 132);
  } else if (currentRecord) {
    fill(255);
    text("WordNet parent: " + currentRecord.wordnetParent, 40, 132);
    text("Category: " + currentRecord.workshopCategory, 40, 154);
  } else {
    fill(255, 120, 120);
    text("No matching record: Unknown", 40, 132);
  }

  // Layer 3: what my sketch turns it into
  fill(255, 200, 120); text("SKETCH SAYS", 40, 185);
  fill(255); textSize(28);
  text(currentRecord ? currentRecord.emoji : "❓", 40, 205);
    textSize(14); fill(200);
  text("Memories: " + history.length + "  (press C to clear)", 300, 215);
}

// Visual response: confidence controls size and steadiness
function drawMainEmoji() {
  let emoji = currentRecord ? currentRecord.emoji : "❓";
  let size = map(currentConfidence, 0, 1, 60, 320);   // more confident = bigger
  let shake = map(currentConfidence, 0, 1, 15, 0);    // less confident = shakier

  push();
  translate(width / 2 + random(-shake, shake), height / 2 + random(-shake, shake));
  textAlign(CENTER, CENTER);
  textSize(size);
  text(emoji, 0, 0);
  if (!currentRecord) {                               // keep the failure visible
    noFill(); stroke(255, 80, 80); strokeWeight(4);
    circle(0, 0, size * 1.3);
  }
  pop();
}

function gotResults(results) {
  if (!results || results.length === 0) return;
  currentLabel = results[0].label;
  currentConfidence = results[0].confidence;
  currentRecord = findMapping(currentLabel);
  maybeRemember();
}
// Decide whether the current result should be remembered
function maybeRemember() {
  if (currentConfidence < MIN_CONFIDENCE) return;
  let key = currentRecord ? currentRecord.workshopCategory : "unknown";
  let now = millis();
  if (now - lastRecordTime < COOLDOWN_MS) return;
  if (key === lastRecordedKey && now - lastRecordTime < 5000) return;

  history.push({
    emoji: currentRecord ? currentRecord.emoji : "❓",
    matched: currentRecord !== null,
    confidence: currentConfidence,
    x: width / 2, y: height / 2,
    vx: random(-3, 3), vy: random(-3, 3),
    age: 0
  });
  if (history.length > MAX_MEMORIES) history.shift();
  lastRecordedKey = key;
  lastRecordTime = now;
}

// Draw remembered emojis as drifting, fading particles
function drawMemories() {
  for (let i = history.length - 1; i >= 0; i--) {
    let m = history[i];
    m.age++;
    m.x += m.vx; m.y += m.vy;
    m.vx *= 0.98; m.vy *= 0.98;
    m.y += sin(frameCount * 0.02 + i) * 0.3;
    if (m.x < 0 || m.x > width) m.vx *= -1;
    if (m.y < 0 || m.y > height) m.vy *= -1;

    if (m.age > 2400) { history.splice(i, 1); continue; }
    let alpha = map(m.age, 0, 1800, 1, 0.1, true);

    push();
    drawingContext.globalAlpha = alpha;
    textAlign(CENTER, CENTER);
    textSize(map(m.confidence, 0, 1, 24, 90));
    text(m.emoji, m.x, m.y);
    if (!m.matched) { noFill(); stroke(255, 80, 80); circle(m.x, m.y, 50); }
    pop();
  }
}

// Press C to clear memory
function keyPressed() {
  if (key === "c" || key === "C") history = [];
}
