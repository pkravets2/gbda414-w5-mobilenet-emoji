let classifier;
let currentLabel = "Waiting for classification...";
let currentConfidence = 0;
let video;

function setup() {
  createCanvas(960, 720);
  video = createCapture(VIDEO, { flipped: true });
  video.size(width, height);
  video.hide();
  classifier = ml5.imageClassifier("MobileNet", { flipped: true });
  classifier.classifyStart(video, gotResults);
}

function draw() {
 image(video, 0, 0, width, height);
  fill(0, 190); noStroke(); rect(20, 20, 600, 90, 12);
  fill(255); textSize(18); textAlign(LEFT, TOP);
  text("Model label: " + currentLabel, 40, 40);
  text("Confidence: " + nf(currentConfidence * 100, 2, 1) + "%", 40, 70);
}

function gotResults(results) {
  if (!results || results.length === 0) return;
  currentLabel = results[0].label;
  currentConfidence = results[0].confidence;
}
