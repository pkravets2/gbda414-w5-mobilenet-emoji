let video;

function setup() {}
  createCanvas(960, 720);
  video = createCapture(VIDEO, { flipped: true });
  video.size(width, height);
  video.hide();
}

function draw() {}
 image(video, 0, 0, width, height);
}