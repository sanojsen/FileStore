// Simple icon generator using Canvas API
// You can run this in browser console to generate icons

function generateIcon(size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Background
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#4f46e5');
  gradient.addColorStop(1, '#7c3aed');
  
  // Rounded rectangle background
  ctx.fillStyle = gradient;
  ctx.roundRect(0, 0, size, size, size * 0.15);
  ctx.fill();

  // File icon
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  const fileWidth = size * 0.4;
  const fileHeight = size * 0.5;
  const fileX = (size - fileWidth) / 2;
  const fileY = size * 0.15;
  ctx.roundRect(fileX, fileY, fileWidth, fileHeight, 4);
  ctx.fill();

  // File lines
  ctx.fillStyle = 'rgba(79, 70, 229, 0.3)';
  const lineHeight = size * 0.02;
  const lineSpacing = size * 0.04;
  for (let i = 0; i < 4; i++) {
    const lineY = fileY + size * 0.08 + (i * lineSpacing);
    const lineWidth = i === 1 ? fileWidth * 0.7 : fileWidth * 0.8;
    ctx.fillRect(fileX + size * 0.02, lineY, lineWidth, lineHeight);
  }

  // Cloud
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  const cloudY = size * 0.75;
  const cloudWidth = size * 0.3;
  const cloudHeight = size * 0.08;
  ctx.ellipse(size/2, cloudY, cloudWidth/2, cloudHeight/2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Upload arrow
  ctx.fillStyle = '#4f46e5';
  const arrowSize = size * 0.06;
  const arrowX = size / 2;
  const arrowY = size * 0.58;
  
  ctx.beginPath();
  ctx.moveTo(arrowX, arrowY);
  ctx.lineTo(arrowX - arrowSize, arrowY + arrowSize);
  ctx.lineTo(arrowX - arrowSize/2, arrowY + arrowSize);
  ctx.lineTo(arrowX - arrowSize/2, arrowY + arrowSize * 2);
  ctx.lineTo(arrowX + arrowSize/2, arrowY + arrowSize * 2);
  ctx.lineTo(arrowX + arrowSize/2, arrowY + arrowSize);
  ctx.lineTo(arrowX + arrowSize, arrowY + arrowSize);
  ctx.closePath();
  ctx.fill();

  return canvas.toDataURL('image/png');
}

// Generate icons for different sizes
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
sizes.forEach(size => {
  const dataUrl = generateIcon(size);
  const link = document.createElement('a');
  link.download = `icon-${size}x${size}.png`;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
});

console.log('Icons generated! Check your Downloads folder.');
