import express from 'express';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from the public directory
app.use(express.static(path.join(process.cwd(), 'public')));

// Start the server
app.listen(PORT, () => {
  console.log(`Visualization server running at http://localhost:${PORT}`);
  console.log(`View auction visualizations at http://localhost:${PORT}/auction_visualizations.html`);
}); 