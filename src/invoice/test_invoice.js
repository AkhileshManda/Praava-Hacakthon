const fs = require('fs');
const path = require('path');
const { generateInvoiceBuffer } = require('./invoice');

async function run() {
    const orderDetails = {
        items: [
            { name: 'Widget A', quantity: 2, price: 10.50 },
            { name: 'Widget B', quantity: 1, price: 20.00 }
        ],
        total: 41.00
    };

    try {
        const buffer = await generateInvoiceBuffer(orderDetails);
        const outputPath = path.join(__dirname, 'test_invoice.pdf');
        fs.writeFileSync(outputPath, buffer);
        console.log(`Invoice generated successfully at: ${outputPath}`);
    } catch (err) {
        console.error('Error generating invoice:', err);
    }
}

run();
