/** Draw the approved face at its authored resolution, adding only its live serial. */
export function drawApprovedCardFace(canvas, image, editionText) {
 canvas.width=900;canvas.height=1260;
 const context=canvas.getContext('2d');
 context.imageSmoothingEnabled=false;
 context.drawImage(image,0,0,900,1260);
 if(editionText){
  context.textAlign='right';context.textBaseline='alphabetic';
  context.font='400 21px Inter,Arial,sans-serif';context.letterSpacing='2.1px';
  context.fillStyle='#eee4ce';context.fillText(editionText,816,1207.344);
 }
 return canvas;
}
