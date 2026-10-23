/** Preset Mehspace themes (homies3 palettes + flyspace) and starter templates for the custom editor. */
export type ThemeId = 'night' | 'glitter' | 'tangerine' | 'pink' | 'denim' | 'flyspace';

export interface Theme { id: ThemeId; label: string; bg: string; ink: string; accent: string; panel: string; border: string }

export const THEMES: Record<ThemeId, Theme> = {
  night: { id: 'night', label: 'RVA night', bg: '#0d1218', ink: '#e7eef6', accent: '#7ec8ff', panel: '#17202b', border: '#2a3a4c' },
  glitter: { id: 'glitter', label: 'Black glitter', bg: '#120d18', ink: '#f6efe6', accent: '#ff4fa3', panel: '#24182c', border: '#4a2d55' },
  tangerine: { id: 'tangerine', label: 'Tangerine', bg: '#2a160f', ink: '#fff4ea', accent: '#ff9f5b', panel: '#3a2218', border: '#5c3524' },
  pink: { id: 'pink', label: 'Hot pink', bg: '#2a1020', ink: '#ffe8f2', accent: '#ff7ab8', panel: '#3d1830', border: '#6a2a52' },
  denim: { id: 'denim', label: 'Y2K denim', bg: '#142033', ink: '#f3f7ff', accent: '#d6e4ff', panel: '#1d2d46', border: '#33507a' },
  flyspace: { id: 'flyspace', label: 'flyspace', bg: '#000000', ink: '#ffffff', accent: '#ff00ff', panel: '#141428', border: '#ff00ff' },
};
export const THEME_IDS = Object.keys(THEMES) as ThemeId[];

export function themeOf(id: string | null | undefined): Theme {
  return THEMES[(id ?? '') as ThemeId] ?? THEMES.night;
}

export const MOODS = ['😎 chillin', '🔥 hyped', '😴 sleepy', '🥲 in my feelings', '🤓 nerding out', '🎸 rocking out', '🍕 hungry', '💅 unbothered', '🌧 gloomy', '✨ sparkly'];

export interface Template { id: string; label: string; theme: ThemeId; html: string; css: string }

/** Starting points for the custom HTML/CSS editor. Every template must pass the sanitizer unchanged (tested). */
export const TEMPLATES: Template[] = [
  {
    id: 'flyspace',
    label: 'flyspace classic',
    theme: 'flyspace',
    html: `<div class="card">
  <h2>✦ About me ✦</h2>
  <p>html was my first language. top 8 or it didn't happen.</p>
  <marquee behavior="scroll" direction="left">✦ this is my vibe, deal with it ✦ ✦ welcome to my page ✦</marquee>
</div>
<div class="card">
  <h2>✦ Who I'd like to meet ✦</h2>
  <p>People who still burn mix CDs.</p>
</div>`,
    css: `body { background: #000; }
.card { background: rgba(20,20,40,0.9); border: 2px solid #ff00ff; border-radius: 8px; padding: 16px; margin-bottom: 12px; box-shadow: 0 0 20px rgba(255,0,255,0.3); }
.card h2 { color: #00ffff; font-size: 16px; margin: 0 0 8px; }
marquee { color: #ff00ff; font-weight: bold; }
.sparkle { animation: sparkle 1.5s infinite; }
@keyframes sparkle { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`,
  },
  {
    id: 'glitter',
    label: 'Glitter wall',
    theme: 'glitter',
    html: `<center>
  <h1 class="glitter">✧ welcome 2 my page ✧</h1>
  <p><b>Currently:</b> listening to my song on repeat</p>
</center>
<table class="facts" width="100%">
  <tr><td><b>Here for</b></td><td>friends, networking, glitter</td></tr>
  <tr><td><b>Hometown</b></td><td>RVA</td></tr>
</table>`,
    css: `body { background: radial-gradient(circle at 20% 20%, #3b1d4a, #120d18 60%); }
.glitter { background: linear-gradient(90deg, #ff4fa3, #ffe066, #7ef9ff, #ff4fa3); -webkit-background-clip: text; background-clip: text; color: transparent; letter-spacing: 3px; }
.facts td { border-bottom: 1px dashed #ff4fa3; padding: 6px; }`,
  },
  {
    id: 'denim',
    label: 'Y2K denim',
    theme: 'denim',
    html: `<div class="box">
  <h3>:: about ::</h3>
  <p>Write something about yourself here.</p>
</div>
<div class="box">
  <h3>:: heroes ::</h3>
  <ul><li>my mom</li><li>whoever invented away messages</li></ul>
</div>`,
    css: `body { background: repeating-linear-gradient(45deg, #142033, #142033 6px, #17263c 6px, #17263c 12px); font-family: Tahoma, Verdana, sans-serif; }
.box { background: #1d2d46; border: 1px solid #33507a; padding: 12px; margin-bottom: 10px; }
.box h3 { margin: 0 0 6px; color: #d6e4ff; text-transform: lowercase; }`,
  },
  {
    id: 'tangerine',
    label: 'Tangerine dream',
    theme: 'tangerine',
    html: `<h2 class="big">hey it's me</h2>
<p class="note">Say hi in my comments. I read every one.</p>`,
    css: `body { background: linear-gradient(180deg, #ff9f5b 0%, #2a160f 45%); }
.big { font-size: 40px; margin: 0; color: #fff4ea; text-shadow: 3px 3px 0 #ff5b2e; }
.note { background: #3a2218; padding: 10px; border-left: 4px solid #ff9f5b; }`,
  },
];
