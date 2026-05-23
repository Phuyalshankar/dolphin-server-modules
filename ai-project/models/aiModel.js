import mongoose from 'mongoose';

const aiTaskSchema = new mongoose.Schema({
  prompt: { type: String, required: true },
  response: { type: String },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

const AITask = mongoose.model('AITask', aiTaskSchema);
export default AITask;
