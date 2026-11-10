import os
import numpy as np
from PIL import Image

assets_dir = os.path.join(os.path.dirname(__file__), 'assets', 'gems')
os.makedirs(assets_dir, exist_ok=True)

def create_gem_sphere(color_rgb, highlight_rgb, filename, size=400):
    y, x = np.ogrid[:size, :size]
    cx, cy = size / 2, size / 2
    r = size * 0.44
    
    dist_sq = (x - cx)**2 + (y - cy)**2
    mask = dist_sq <= r**2
    
    z = np.sqrt(np.maximum(0, r**2 - dist_sq)) / r
    nx = (x - cx) / r
    ny = (y - cy) / r
    
    lx, ly, lz = -0.5, -0.6, 0.75
    lnorm = np.sqrt(lx**2 + ly**2 + lz**2)
    lx, ly, lz = lx/lnorm, ly/lnorm, lz/lnorm
    
    diff = np.maximum(0, nx*lx + ny*ly + z*lz)
    ambient = 0.28
    intensity = ambient + 0.65 * diff
    
    hx, hy, hz = lx, ly, lz + 1.0
    hnorm = np.sqrt(hx**2 + hy**2 + hz**2)
    hx, hy, hz = hx/hnorm, hy/hnorm, hz/hnorm
    spec = np.maximum(0, nx*hx + ny*hy + z*hz) ** 32
    
    rx, ry, rz = 0.6, 0.6, 0.25
    rnorm = np.sqrt(rx**2 + ry**2 + rz**2)
    rx, ry, rz = rx/rnorm, ry/rnorm, rz/rnorm
    rim = np.maximum(0, nx*rx + ny*ry + z*rz) ** 4 * 0.4
    
    img = np.zeros((size, size, 4), dtype=np.uint8)
    
    base_r, base_g, base_b = color_rgb
    hl_r, hl_g, hl_b = highlight_rgb
    
    cr = np.clip(base_r * intensity + hl_r * spec * 1.3 + base_r * rim, 0, 255)
    cg = np.clip(base_g * intensity + hl_g * spec * 1.3 + base_g * rim, 0, 255)
    cb = np.clip(base_b * intensity + hl_b * spec * 1.3 + base_b * rim, 0, 255)
    
    img[mask, 0] = cr[mask]
    img[mask, 1] = cg[mask]
    img[mask, 2] = cb[mask]
    img[mask, 3] = 255
    
    edge_width = 2.0
    dist = np.sqrt(dist_sq)
    edge_mask = (dist > (r - edge_width)) & (dist <= (r + 1.0))
    alpha_factor = np.clip((r - dist[edge_mask] + 1.0) / (edge_width + 1.0), 0, 1)
    img[edge_mask, 3] = (alpha_factor * 255).astype(np.uint8)
    
    pil_img = Image.fromarray(img, 'RGBA')
    pil_img.save(filename, 'PNG')
    print(f'Generated: {filename}')

gems = {
    'Aqeeq': ((185, 30, 25), (255, 215, 205)),
    'Firoza': ((15, 160, 175), (200, 255, 255)),
    'Yaqoot': ((205, 18, 65), (255, 200, 220)),
    'Zumurrud': ((14, 145, 80), (190, 255, 220)),
    'Neelam': ((20, 60, 185), (205, 225, 255)),
    'Pukhraj': ((225, 150, 18), (255, 245, 185)),
    'Dur-e-Najaf': ((175, 195, 215), (255, 255, 255)),
    'Marjan': ((220, 55, 45), (255, 210, 195))
}

for name, (base, hl) in gems.items():
    filename = os.path.join(assets_dir, f'{name.lower().replace("-", "_")}.png')
    create_gem_sphere(base, hl, filename)

# Crop tournament logo and save in assets
t_logo_src = r'C:\Users\USER\.gemini\antigravity\brain\6a38d385-9752-46a9-8efb-a4d3c1e3deb6\.user_uploaded\media_1794335762936_b58b23cb.jpg'
if os.path.exists(t_logo_src):
    t_img = Image.open(t_logo_src)
    cropped = t_img.crop((0, 90, 640, 558))
    t_out = os.path.join(assets_dir, 'tournament_logo.png')
    cropped.save(t_out, 'PNG')
    print(f'Generated tournament logo: {t_out}')

print('All assets prepared!')

