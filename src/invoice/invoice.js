const PDFDocument = require('pdfkit');

function generateInvoiceBuffer(orderDetails) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 50 });
            const buffers = [];
            
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
                const pdfData = Buffer.concat(buffers);
                resolve(pdfData);
            });

            // Invoice Header
            doc.fontSize(20).text('INVOICE', { align: 'center' });
            doc.moveDown();

            // Date
            doc.fontSize(12).text(`Date: ${new Date().toLocaleDateString()}`);
            doc.moveDown();

            // Order details table header
            doc.fontSize(14).text('Item Name', 50, 150);
            doc.text('Quantity', 300, 150);
            doc.text('Total Price', 400, 150);
            
            doc.moveTo(50, 170).lineTo(500, 170).stroke();
            
            let yPosition = 190;
            
            if (orderDetails && orderDetails.items) {
                orderDetails.items.forEach(item => {
                    doc.fontSize(12).text(item.name, 50, yPosition);
                    doc.text(item.quantity.toString(), 300, yPosition);
                    doc.text(`$${item.price.toFixed(2)}`, 400, yPosition);
                    yPosition += 20;
                });
            }
            
            doc.moveTo(50, yPosition + 10).lineTo(500, yPosition + 10).stroke();
            
            // Total
            if (orderDetails && orderDetails.total !== undefined) {
                doc.fontSize(14).text('Total:', 300, yPosition + 30);
                doc.text(`$${orderDetails.total.toFixed(2)}`, 400, yPosition + 30);
            }
            
            doc.end();
        } catch (error) {
            reject(error);
        }
    });
}

module.exports = { generateInvoiceBuffer };
