const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Load system prompt for GPT-4o
const systemPrompt = fs.readFileSync('./sysprompt.txt', 'utf8');

// Main endpoint for generating app icons
app.post('/api/generate-icon', async (req, res) => {
  try {
    const { appDescription, presets } = req.body;
    
    if (!appDescription) {
      return res.status(400).json({ error: 'App description is required' });
    }

    console.log(`Generating icon for: "${appDescription}"`);
    
    // Step 1: Generate icon description using GPT-4o
    let iconDescription = await generateIconDescription(appDescription);
    // Append preset styles (if any) to the generated description
    if (presets && presets.length > 0) {
      iconDescription = iconDescription + ', ' + presets.join(', ');
    }
    console.log(`Generated icon description: "${iconDescription}"`);
    
    // Step 2: Generate image using Replicate Flux Schnell
    const imageUrl = await generateImage(iconDescription);
    console.log(`Generated image URL: ${imageUrl}`);
    
    res.json({
      success: true,
      imageUrl,
      iconDescription
    });
    
  } catch (error) {
    console.error('Error generating icon:', error.message);
    res.status(500).json({ 
      error: 'Failed to generate icon', 
      message: error.message 
    });
  }
});

// Function to generate icon description using OpenAI GPT-4o
async function generateIconDescription(appDescription) {
  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: appDescription }
        ],
        response_format: { type: 'json_object' }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        }
      }
    );
    const responseData = response.data;
    const jsonResponse = JSON.parse(responseData.choices[0].message.content);
    return jsonResponse.iconDescription;
    
  } catch (error) {
    console.error('OpenAI API error:', error.response?.data || error.message);
    throw new Error('Failed to generate icon description');
  }
}

// Function to generate image using Replicate Flux Schnell
async function generateImage(iconDescription) {
  try {
    const createResponse = await axios.post(
      'https://api.replicate.com/v1/predictions',
      {
        version: "black-forest-labs/flux-schnell",
        input: {
          prompt: iconDescription,
          num_outputs: 1,
          aspect_ratio: "1:1",
          num_inference_steps: 4,
          output_format: "png"
        }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`
        }
      }
    );

    const predictionId = createResponse.data.id;
    let imageUrl = null;
    let attempts = 0;
    const maxAttempts = 30;
    
    while (!imageUrl && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const pollResponse = await axios.get(
        `https://api.replicate.com/v1/predictions/${predictionId}`,
        {
          headers: {
            'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`
          }
        }
      );
      
      if (pollResponse.data.status === 'succeeded') {
        imageUrl = pollResponse.data.output[0];
        break;
      } else if (pollResponse.data.status === 'failed') {
        throw new Error('Image generation failed: ' + (pollResponse.data.error || 'Unknown error'));
      }
      
      attempts++;
    }
    
    if (!imageUrl) {
      throw new Error('Timed out waiting for image generation');
    }
    
    return imageUrl;
    
  } catch (error) {
    console.error('Replicate API error:', error.response?.data || error.message);
    throw new Error('Failed to generate image');
  }
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
