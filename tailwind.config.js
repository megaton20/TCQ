/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './views/**/*.ejs',
    './public/js/**/*.js'
  ],
  theme: {
    extend: {
      colors: {
        carnival: {
          gold: '#D4AF37',
          green: '#0B5D33',
          greenDark: '#073D21',
          cream: '#FBF7EE'
        }
      }
    }
  },
  plugins: []
};
