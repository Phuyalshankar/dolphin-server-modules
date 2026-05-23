import AITask from '../models/aiModel.js';
import { DolphinAgent } from '../../src/ai/dolphin-agent/agent.js';

export const createAITask = async (ctx) => {
  try {
    const { prompt } = ctx.body;
    const task = new AITask({ prompt });
    await task.save();

    // Dolphin Agent init garera task process garne
    const agent = new DolphinAgent({ framework: 'dolphin' });
    
    // Demo ko lagi simple response
    ctx.json({ 
      message: "AI Agent received the task", 
      status: "Processing",
      task 
    });
  } catch (err) {
    ctx.status(500).json({ message: err.message });
  }
};

export const getAITasks = async (ctx) => {
  try {
    const tasks = await AITask.find();
    ctx.json(tasks);
  } catch (err) {
    ctx.status(500).json({ message: err.message });
  }
};
