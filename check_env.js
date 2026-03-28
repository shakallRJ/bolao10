
console.log('Env keys:', Object.keys(process.env).filter(k => k.includes('DB') || k.includes('URL') || k.includes('KEY') || k.includes('SECRET')));
