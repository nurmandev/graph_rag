import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GraphData, GraphDataDocument } from './graphData.schema';
import OpenAI from 'openai';

@Injectable()
export class GraphDataService {
  private openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  constructor(
    @InjectModel('GraphData', 'graphDB')
    private graphDataModel: Model<GraphDataDocument>,
  ) {}

  async saveGraphData(graphDataDto: {
    chatId: string;
    userId: string;
    selectedProvider: string;
    endpoint: string;
    indexName: string;
    description: string;
  }) {
    try {
      return await this.graphDataModel.findOneAndUpdate(
        { chatId: graphDataDto.chatId },
        { $set: graphDataDto },
        { upsert: true, new: true },
      );
    } catch (error) {
      console.error('Error saving Graph Data:', error);
      throw new InternalServerErrorException('Failed to save Graph Data');
    }
  }

  async getAllGraphData(): Promise<GraphData[]> {
    try {
      return await this.graphDataModel.find().exec();
    } catch (error) {
      console.error('Service Error fetching Graph Data:', error);
      throw new InternalServerErrorException('Failed to fetch Graph Data');
    }
  }

  async getGraphData(id: string): Promise<GraphData | null> {
    try {
      return await this.graphDataModel.findById(id).exec();
    } catch (error) {
      console.error('Service Error fetching Graph Data:', error);
      throw new InternalServerErrorException('Failed to fetch Graph Data');
    }
  }

  async generateDetails(dto: { chatHistory: string }) {
    const { chatHistory } = dto;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `
  You are an AI assistant tasked with generating a concise and relevant title and description for a subindex based on chat history. meaning base on the discussion in the chat history, you will generate a title and description for the subindex. The title should be a short phrase that captures the essence of the subindex, while the description should provide a brief overview of its content and purpose. The title and description should be clear, informative, and engaging to users.
  The title should be no more than 10 words, and the description should be 1-3 sentences long. The title and description should not deduce that its from a chat histories. The title and description should be relevant to the content of the subindex and should not contain any personal information or sensitive data.
  
  Your output MUST be a valid JSON object in the following format:
  
  {
    "title": "Generated title here",
    "description": "Generated description here"
  }
            `.trim(),
        },
        {
          role: 'user',
          content: `
  Here is the chat history used to create the index:
  
  ${chatHistory}
  
  Generate a suitable title and a 1–2 sentence description, following the format specified above.
            `.trim(),
        },
      ],
      temperature: 0.5,
      max_tokens: 300,
    });

    const content = response.choices[0]?.message?.content || '';

    try {
      const parsed = JSON.parse(content);
      if (parsed?.title && parsed?.description) {
        return parsed;
      }
    } catch (err) {
      console.warn('Invalid JSON from AI:', content);
    }

    throw new Error('AI response format invalid or empty');
  }
}
