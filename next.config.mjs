/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // מזהיר אבל לא עוצר את הבנייה בגלל שגיאות ESLint
    ignoreDuringBuilds: true,
  },
  typescript: {
    // מזהיר אבל לא עוצר את הבנייה בגלל שגיאות TypeScript
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
