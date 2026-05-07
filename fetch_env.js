const url = 'https://serene-budget-tool.lovable.app';
fetch(url)
  .then(res => res.text())
  .then(async html => {
    const scripts = [...html.matchAll(/<script[^>]+src=\"([^\"]+)\"/g)].map(m => m[1]);
    for(const src of scripts) {
      const fullUrl = src.startsWith('http') ? src : new URL(src, url).href;
      const res = await fetch(fullUrl);
      const js = await res.text();
      const supabaseUrlMatch = js.match(/https:\/\/[a-z0-9]+\.supabase\.co/);
      const supabaseKeyMatch = js.match(/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/);
      if (supabaseUrlMatch && supabaseKeyMatch) {
        console.log('SUPABASE_URL=' + supabaseUrlMatch[0]);
        console.log('SUPABASE_KEY=' + supabaseKeyMatch[0]);
      }
    }
  });
