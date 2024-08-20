import fs from 'fs/promises';
import path from 'path';
// import { PDFDocument } from 'pdf-lib'; // To manipulate PDF files
// import express from '@pdftron/pdfjs-express'; // To extract text from PDF
import extract from 'pdf-text-extract'; // To extract text from PDF




async function readPdfContent(filePath) {
    return new Promise((resolve, reject) => {
        extract(filePath, (err, pages) => {
            if (err) {
                return reject(err);
            }
            resolve(pages.join(' ')); // Join all pages text into a single string
        });
    });
}

async function processPdfWithChatGPT(pdfText) {
    const prompt = `
я хочу чтобы ты прочитал резюме кандидата и вычленил профессиональные качества этого человека. 
Меня интересует следующая информация: имя, профессия, сколько лет опыта, индустрия
Постарайся выбирать только факты представленные в документе с минимумом допущений. 
Результат должен быть в json формате следующего вида {"ФИО":"Иванов Иван Иванович", "профессия": "software injeneer", "годаОпыта": "10 лет", "индустрия": "геймдев"}
Если информации недостаточно просто оставь поле пустым. 
`
    const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
            {role: "system", content: prompt},
            {
                role: "user",
                content: pdfText,
            },
        ],
    });

    return completion.choices[0].message;
}

function parseOutput(response) {
    console.log('parse', response)
    const preTrim =  response.content.trim().slice(7, -3)

    try {
        const jsonObject = JSON.parse(preTrim);
        return jsonObject;
    } catch (error) {
        console.error("Error parsing JSON:", error);
        return null;
    }
}

async function generateCSV() {
    const directoryPath = path.join('data', 'cvs');
    const outputDir = path.join('data', 'output');

    // Ensure the output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    // Get current date and time
    const now = new Date();
    const yyyyMMddhhmmss = now.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
    
    const outputFileName = `files_${yyyyMMddhhmmss}.csv`;
    const outputFilePath = path.join(outputDir, outputFileName);

    try {
        // Read the directory
        const files = await fs.readdir(directoryPath);

        // Filter out non-PDF files
        const pdfFiles = files.filter(file => file.endsWith('.pdf'));

        // Get file details
        const fileDetails = await Promise.all(
            pdfFiles.map(async (file) => {
                const filename = path.join(directoryPath, file);
                const stats = await fs.stat(filename);

                
                // Read the PDF content
                const pdfContent = await readPdfContent(filename);

                // Send the content to ChatGPT and get the response
                const gptResponse = await processPdfWithChatGPT(pdfContent);
                
                console.log(gptResponse);
                
                return `${file},${stats.size}`;
            })
        ); 

        // Write to CSV
        const csvContent = 'File Name,Size (bytes)\n' + fileDetails.join('\n');
        await fs.writeFile(outputFilePath, csvContent, 'utf8');

        console.log(`CSV file created: ${outputFilePath}`);
    } catch (error) {
        console.error('Error reading directory or writing CSV file:', error);
    }
}

generateCSV();
