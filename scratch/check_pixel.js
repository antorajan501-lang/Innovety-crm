const fs = require('fs');
const { execSync } = require('child_process');

const htmlContent = `
<!DOCTYPE html>
<html>
<body>
<img id="img" src="file:///C:/Users/Luffy/.gemini/antigravity-ide/brain/5152619e-02b8-493f-9022-61e8862f9ed2/login_full_card_green.png" />
<canvas id="c"></canvas>
<script>
window.onload = () => {
  const img = document.getElementById('img');
  const c = document.getElementById('c');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  
  // The button is around x = 720 (center-right), y = 570
  // Let's sample around the button:
  const p = ctx.getImageData(img.naturalWidth * 0.65, img.naturalHeight * 0.63, 1, 1).data;
  console.log('PIXEL_RGBA:' + p[0] + ',' + p[1] + ',' + p[2] + ',' + p[3]);
};
</script>
</body>
</html>
`;

fs.writeFileSync('scratch/pixel_check.html', htmlContent);
console.log('Written pixel_check.html');
