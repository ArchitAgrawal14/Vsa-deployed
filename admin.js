import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import PDFDocument from 'pdfkit';
import fs from 'fs';
import cookieParser from "cookie-parser";
import sendNewsletter from "./SendMail.js";
import { fileURLToPath } from "url";
import { dirname } from "path";

const app = express();
const _dirname = dirname(fileURLToPath(import.meta.url));
app.set("view engine", "ejs");
app.set("views", _dirname + "/views"); // Set the path to the views directory
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(_dirname + "/public"));
const db = new pg.Client({
  host: process.env.databaseHost,
  password: process.env.databasePassword,
  database: "vsa",
  port: 5432,
  user: "postgres",
});
export async function adminRole(req, res, firstName) {
  res.render("adminDashboard.ejs", {
    Login: firstName,
  });
}
export async function createNewsLetterAdmin(req, res) {
  //   const adminCheck=await db.query("SELECT * FROM users WHERE email=$1",[Email]);
  try {
    // if(adminCheck.rows.length>0 && adminCheck.rows[0].admin===true){
    res.render("CreateNewsLetter.ejs");
    console.log("User is the admin hence opening news letter creation page");
    // }else{
    //   console.log("User is not the admin");
    // }
  } catch (error) {
    console.log("news letter page error:", error);
  }
}

export async function downloadOnlineUsersList(req, res,users) {
  try {
    // Create a new PDF document
    const doc = new PDFDocument();
  
    // Set response headers
    res.setHeader('Content-disposition', 'attachment; filename=Online_Users_list_VSA.pdf');
    res.setHeader('Content-type', 'application/pdf');
  
    // Pipe the PDF document to the response
    doc.pipe(res);
  
    // Define table settings
    const margin = 50;
    const tableTop = 100;
    const columnWidths = [150, 200, 150]; // Width for each column
    const rowHeight = 20;
    const tableWidth = columnWidths.reduce((a, b) => a + b, 0);

    // Add title to the PDF
    doc.fontSize(16).text('Users List', { align: 'center' });
    doc.moveDown();
  
    // Draw table headers
    doc.fontSize(12)
      .text('Full Name', margin, tableTop)
      .text('Email', margin + columnWidths[0], tableTop)
      .text('Mobile Number', margin + columnWidths[0] + columnWidths[1], tableTop);

    // Draw the header underline
    doc.moveTo(margin, tableTop + rowHeight)
      .lineTo(margin + tableWidth, tableTop + rowHeight)
      .stroke();

    // Draw rows and data
    users.forEach((user, index) => {
      const y = tableTop + (index + 1) * rowHeight + rowHeight; // Position for each row

      doc.text(user.full_name, margin, y)
        .text(user.email, margin + columnWidths[0], y)
        .text(user.mobile_number, margin + columnWidths[0] + columnWidths[1], y);

      // Draw row border
      doc.moveTo(margin, y + rowHeight / 2)
        .lineTo(margin + tableWidth, y + rowHeight / 2)
        .stroke();
    });

    // Draw the bottom border of the last row
    doc.moveTo(margin, tableTop + (users.length + 1) * rowHeight + rowHeight / 2)
      .lineTo(margin + tableWidth, tableTop + (users.length + 1) * rowHeight + rowHeight / 2)
      .stroke();

    // Finalize the PDF and end the stream
    doc.end();
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).send('Error generating PDF');
  }
}
export async function downloadOfflineUsersList(req, res,users) {
    try {
      // Create a new PDF document
      const doc = new PDFDocument();
    
      // Set response headers
      res.setHeader('Content-disposition', 'attachment; filename=Offline_Users_list_VSA.pdf');
      res.setHeader('Content-type', 'application/pdf');
    
      // Pipe the PDF document to the response
      doc.pipe(res);
    
      // Define table settings
      const margin = 50;
      const tableTop = 100;
      const columnWidths = [150, 200, 150]; // Width for each column
      const rowHeight = 20;
      const tableWidth = columnWidths.reduce((a, b) => a + b, 0);
  
      // Add title to the PDF
      doc.fontSize(16).text('Users List', { align: 'center' });
      doc.moveDown();
    
      // Draw table headers
      doc.fontSize(12)
        .text('Full Name', margin, tableTop)
        .text('Email', margin + columnWidths[0], tableTop)
        .text('Mobile Number', margin + columnWidths[0] + columnWidths[1], tableTop);
  
      // Draw the header underline
      doc.moveTo(margin, tableTop + rowHeight)
        .lineTo(margin + tableWidth, tableTop + rowHeight)
        .stroke();
  
      // Draw rows and data
      users.forEach((user, index) => {
        const y = tableTop + (index + 1) * rowHeight + rowHeight; // Position for each row
  
        doc.text(user.full_name, margin, y)
          .text(user.email, margin + columnWidths[0], y)
          .text(user.mobile_number, margin + columnWidths[0] + columnWidths[1], y);
  
        // Draw row border
        doc.moveTo(margin, y + rowHeight / 2)
          .lineTo(margin + tableWidth, y + rowHeight / 2)
          .stroke();
      });
  
      // Draw the bottom border of the last row
      doc.moveTo(margin, tableTop + (users.length + 1) * rowHeight + rowHeight / 2)
        .lineTo(margin + tableWidth, tableTop + (users.length + 1) * rowHeight + rowHeight / 2)
        .stroke();
  
      // Finalize the PDF and end the stream
      doc.end();
    } catch (error) {
      console.error('Error generating PDF:', error);
      res.status(500).send('Error generating PDF');
    }
}
export async function downloadavailableStock(req, res, totalStock) {
  try {
    // Create a new PDF document
    const doc = new PDFDocument({ margin: 30 });

    // Set response headers
    res.setHeader('Content-disposition', 'attachment; filename=Stock_list_VSA.pdf');
    res.setHeader('Content-type', 'application/pdf');

    // Pipe the PDF document to the response
    doc.pipe(res);

    // Add title to the PDF
    doc.fontSize(20).text('Available Stock List VSA', { align: 'center' }).moveDown(1);

    // Add date
    doc.fontSize(12).text(`Date: ${new Date().toLocaleDateString()}`, { align: 'right' }).moveDown(1);

    // Define table settings
    const tableTop = 120;
    const itemWidth = 150;
    const idWidth = 150;
    const priceWidth = 100;
    const quantityWidth = 100;
    const tableWidth = itemWidth + idWidth + priceWidth + quantityWidth;
    const rowHeight = 20;

    // Draw table headers
    doc.fontSize(12).font('Helvetica-Bold')
      .text('Item Name', 30, tableTop, { width: itemWidth, align: 'left' })
      .text('Item ID', 30 + itemWidth, tableTop, { width: idWidth, align: 'left' })
      .text('Price', 30 + itemWidth + idWidth, tableTop, { width: priceWidth, align: 'left' })
      .text('Quantity', 30 + itemWidth + idWidth + priceWidth, tableTop, { width: quantityWidth, align: 'left' });

    // Draw header underline
    doc.moveTo(30, tableTop + rowHeight).lineTo(30 + tableWidth, tableTop + rowHeight).stroke();

    // Draw rows
    totalStock.forEach((stock, i) => {
      const y = tableTop + (i + 1) * rowHeight;
      const fillColor = i % 2 === 0 ? '#f0f0f0' : '#ffffff';

      // Draw row background color
      doc.rect(30, y, tableWidth, rowHeight).fill(fillColor).stroke();

      doc.fontSize(12).font('Helvetica')
        .fillColor('#000000')
        .text(stock.name, 30, y + 5, { width: itemWidth, align: 'left' })
        .text(stock.item_id, 30 + itemWidth, y + 5, { width: idWidth, align: 'left' })
        .text(stock.price, 30 + itemWidth + idWidth, y + 5, { width: priceWidth, align: 'left' })
        .text(stock.quantity, 30 + itemWidth + idWidth + priceWidth, y + 5, { width: quantityWidth, align: 'left' });
    });

    // Add footer
    const footerText = 'Generated by VSA Inventory System';
    doc.fontSize(10).fillColor('#888888')
      .text(footerText, 30, doc.page.height - 30, { align: 'center' });

    // Finalize the PDF and end the stream
    doc.end();
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).send('Error generating PDF');
  }
}
export async function downloadOnlineSaleList(req, res, ordersOnline) {
    try {
        // Create a new PDF document
        const doc = new PDFDocument({ margin: 30 });

        // Set response headers
        res.setHeader('Content-disposition', 'attachment; filename=Online_Sale_list_VSA.pdf');
        res.setHeader('Content-type', 'application/pdf');

        // Pipe the PDF document to the response
        doc.pipe(res);

        // Add title to the PDF
        doc.fontSize(20).text('Available Online Sale List VSA', { align: 'center' }).moveDown(1);

        // Add date
        doc.fontSize(12).text(`Date: ${new Date().toLocaleDateString()}`, { align: 'right' }).moveDown(1);

        // Define table settings with reduced column widths
        const tableTop = 120;
        const colWidths = {
            orderId: 60,
            paymentId: 80,
            email: 130,
            name: 70,
            mobile: 90,
            itemId: 30,
            price: 40,
            quantity: 33,
            purchaseDate: 70
        };
        const rowHeight = 20;
        const margin = 30;

        // Calculate total table width
        const tableWidth = Object.values(colWidths).reduce((a, b) => a + b, 0);

        // Draw table headers with smaller font size
        doc.fontSize(8).font('Helvetica-Bold')
            .text('Order Id', margin, tableTop, { width: colWidths.orderId, align: 'left' })
            .text('Payment Id', margin + colWidths.orderId, tableTop, { width: colWidths.paymentId, align: 'left' })
            .text('Email', margin + colWidths.orderId + colWidths.paymentId, tableTop, { width: colWidths.email, align: 'left' })
            .text('Name', margin + colWidths.orderId + colWidths.paymentId + colWidths.email, tableTop, { width: colWidths.name, align: 'left' })
            .text('Mobile', margin + colWidths.orderId + colWidths.paymentId + colWidths.email + colWidths.name, tableTop, { width: colWidths.mobile, align: 'left' })
            .text('Item Id', margin + colWidths.orderId + colWidths.paymentId + colWidths.email + colWidths.name + colWidths.mobile, tableTop, { width: colWidths.itemId, align: 'left' })
            .text('Price', margin + colWidths.orderId + colWidths.paymentId + colWidths.email + colWidths.name + colWidths.mobile + colWidths.itemId, tableTop, { width: colWidths.price, align: 'left' })
            .text('Quantity', margin + colWidths.orderId + colWidths.paymentId + colWidths.email + colWidths.name + colWidths.mobile + colWidths.itemId + colWidths.price, tableTop, { width: colWidths.quantity, align: 'left' })
            .text('Date', margin + colWidths.orderId + colWidths.paymentId + colWidths.email + colWidths.name + colWidths.mobile + colWidths.itemId + colWidths.price + colWidths.quantity, tableTop, { width: colWidths.purchaseDate, align: 'left' });

        // Draw header underline
        doc.moveTo(margin, tableTop + rowHeight).lineTo(margin + tableWidth, tableTop + rowHeight).stroke();

        // Draw rows
        ordersOnline.forEach((item, i) => {
            const y = tableTop + (i + 1) * rowHeight;
            const fillColor = i % 2 === 0 ? '#f0f0f0' : '#ffffff';

            // Draw row background color
            doc.rect(margin, y, tableWidth, rowHeight).fill(fillColor).stroke();

            doc.fontSize(10).font('Helvetica').fillColor('#000000')
                .text(item.order_id, margin, y + 5, { width: colWidths.orderId, align: 'left' })
                .text(item.payment_id, margin + colWidths.orderId, y + 5, { width: colWidths.paymentId, align: 'left' })
                .text(item.email, margin + colWidths.orderId + colWidths.paymentId, y + 5, { width: colWidths.email, align: 'left' })
                .text(item.name, margin + colWidths.orderId + colWidths.paymentId + colWidths.email, y + 5, { width: colWidths.name, align: 'left' })
                .text(item.mobile_number, margin + colWidths.orderId + colWidths.paymentId + colWidths.email + colWidths.name, y + 5, { width: colWidths.mobile, align: 'left' })
                .text(item.item_id, margin + colWidths.orderId + colWidths.paymentId + colWidths.email + colWidths.name + colWidths.mobile, y + 5, { width: colWidths.itemId, align: 'left' })
                .text(item.price, margin + colWidths.orderId + colWidths.paymentId + colWidths.email + colWidths.name + colWidths.mobile + colWidths.itemId, y + 5, { width: colWidths.price, align: 'left' })
                .text(item.quantity, margin + colWidths.orderId + colWidths.paymentId + colWidths.email + colWidths.name + colWidths.mobile + colWidths.itemId + colWidths.price, y + 5, { width: colWidths.quantity, align: 'left' })
                .text(item.created_at, margin + colWidths.orderId + colWidths.paymentId + colWidths.email + colWidths.name + colWidths.mobile + colWidths.itemId + colWidths.price + colWidths.quantity, y + 5, { width: colWidths.purchaseDate, align: 'left' });
        });

        // Add footer
        const footerText = 'Generated by VSA Inventory System';
        doc.fontSize(10).fillColor('#888888')
            .text(footerText, margin, doc.page.height - 30, { align: 'center' });

        // Finalize the PDF and end the stream
        doc.end();
    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).send('Error generating PDF');
    }
}
export async function downloadOfflineSaleList(req, res, ordersOffline) {
    try {
        // Create a new PDF document with a margin of 30
        const doc = new PDFDocument({ margin: 30 });

        // Set response headers
        res.setHeader('Content-disposition', 'attachment; filename=Offline_Sale_list_VSA.pdf');
        res.setHeader('Content-type', 'application/pdf');

        // Pipe the PDF document to the response
        doc.pipe(res);

        // Add title to the PDF
        doc.fontSize(20).text('Available Online Sale List VSA', { align: 'center' }).moveDown(1);

        // Add date
        doc.fontSize(12).text(`Date: ${new Date().toLocaleDateString()}`, { align: 'right' }).moveDown(1);

        // Define table settings with reduced column widths
        const tableTop = 120;
        const colWidths = {
            email: 130,
            name: 70,
            mobile: 90,
            itemId: 50,
            price: 50,
            quantity: 50,
            purchaseDate: 90
        };
        const rowHeight = 20;
        const margin = 30;

        // Calculate total table width
        const tableWidth = Object.values(colWidths).reduce((a, b) => a + b, 0);

        // Draw table headers with smaller font size
        doc.fontSize(8).font('Helvetica-Bold')
            .text('Email', margin, tableTop, { width: colWidths.email, align: 'left' })
            .text('Name', margin + colWidths.email, tableTop, { width: colWidths.name, align: 'left' })
            .text('Mobile', margin + colWidths.email + colWidths.name, tableTop, { width: colWidths.mobile, align: 'left' })
            .text('Item Id', margin + colWidths.email + colWidths.name + colWidths.mobile, tableTop, { width: colWidths.itemId, align: 'left' })
            .text('Price', margin + colWidths.email + colWidths.name + colWidths.mobile + colWidths.itemId, tableTop, { width: colWidths.price, align: 'left' })
            .text('Quantity', margin + colWidths.email + colWidths.name + colWidths.mobile + colWidths.itemId + colWidths.price, tableTop, { width: colWidths.quantity, align: 'left' })
            .text('Date', margin + colWidths.email + colWidths.name + colWidths.mobile + colWidths.itemId + colWidths.price + colWidths.quantity, tableTop, { width: colWidths.purchaseDate, align: 'left' });

        // Draw header underline
        doc.moveTo(margin, tableTop + rowHeight).lineTo(margin + tableWidth, tableTop + rowHeight).stroke();

        // Draw rows
        ordersOffline.forEach((item, i) => {
            const y = tableTop + (i + 1) * rowHeight;
            const fillColor = i % 2 === 0 ? '#f0f0f0' : '#ffffff';

            // Draw row background color
            doc.rect(margin, y, tableWidth, rowHeight).fill(fillColor).stroke();

            doc.fontSize(8).font('Helvetica').fillColor('#000000')
                .text(item.email, margin, y + 5, { width: colWidths.email, align: 'left' })
                .text(item.name, margin + colWidths.email, y + 5, { width: colWidths.name, align: 'left' })
                .text(item.mobile_number, margin + colWidths.email + colWidths.name, y + 5, { width: colWidths.mobile, align: 'left' })
                .text(item.item_id, margin + colWidths.email + colWidths.name + colWidths.mobile, y + 5, { width: colWidths.itemId, align: 'left' })
                .text(item.amount, margin + colWidths.email + colWidths.name + colWidths.mobile + colWidths.itemId, y + 5, { width: colWidths.price, align: 'left' })
                .text(item.quantity, margin + colWidths.email + colWidths.name + colWidths.mobile + colWidths.itemId + colWidths.price, y + 5, { width: colWidths.quantity, align: 'left' })
                .text(item.created_at.toLocaleDateString(), margin + colWidths.email + colWidths.name + colWidths.mobile + colWidths.itemId + colWidths.price + colWidths.quantity, y + 5, { width: colWidths.purchaseDate, align: 'left' });
        });

        // Add footer
        const footerText = 'Generated by VSA Inventory System';
        doc.fontSize(10).fillColor('#888888')
            .text(footerText, margin, doc.page.height - 30, { align: 'center' });

        // Finalize the PDF and end the stream
        doc.end();
    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).send('Error generating PDF');
    }
}

export async function editAchievementsText(req,res,editTextForAchievements,firstName) {
    const result=await db.query("SELECT * FROM home_page_data")
    const data=result.rows[0];
try {
        if(data){
            await db.query("UPDATE home_page_data SET achievements_text=$1",[editTextForAchievements]);
            res.render("adminDashboard.ejs", {
                toastForNewsLetter: true,
                Login: firstName,
              });
        }else{
            console.log("data cannot be retrieved from database for home page data");
            res.render("adminDashboard.ejs", {
                toastForNewsLetter: false,
                Login: firstName,
            });
        }   
    } catch (error) {
        res.render("adminDashboard.ejs", {
            toastForNewsLetter: false,
            Login: firstName,
        });    
}
}
export async function editMeetOurCoachText(req,res,editMeetOurCoachText,firstName) {
    const result=await db.query("SELECT * FROM home_page_data")
    const data=result.rows[0];
try {
        if(data){
            await db.query("UPDATE home_page_data SET meet_our_coach_text=$1",[editMeetOurCoachText]);
            res.render("adminDashboard.ejs", {
                toastForNewsLetter: true,
                Login: firstName,
              });
        }else{
            console.log("data cannot be retrieved from database for home page data");
            res.render("adminDashboard.ejs", {
                toastForNewsLetter: false,
                Login: firstName,
            });
        }   
    } catch (error) {
        res.render("adminDashboard.ejs", {
            toastForNewsLetter: false,
            Login: firstName,
        });    
}
}
export async function getOrderDetails(req, res, order_data) {
    try {
      // Create a new PDF document
      const doc = new PDFDocument();
      
      // Set response headers
      res.setHeader('Content-disposition', 'attachment; filename=Order_details_VSA.pdf');
      res.setHeader('Content-type', 'application/pdf');
      
      // Pipe the PDF document to the response
      doc.pipe(res);
      
      // Add title to the PDF
      doc.fontSize(20).text('Order Details', { align: 'center' });
      doc.moveDown();
      
      if (order_data && order_data.length > 0) {
        order_data.forEach(order => {
          doc.font('Helvetica-Bold').text('Order id: ', { continued: true }).font('Helvetica').text(order.order_id);
          doc.font('Helvetica-Bold').text('Payment id: ', { continued: true }).font('Helvetica').text(order.payment_id);
          doc.font('Helvetica-Bold').text('Customer Email: ', { continued: true }).font('Helvetica').text(order.email);
          doc.font('Helvetica-Bold').text('Customer Name: ', { continued: true }).font('Helvetica').text(order.name);
          doc.font('Helvetica-Bold').text('Customer Mobile Number: ', { continued: true }).font('Helvetica').text(order.mobile_number);
          doc.font('Helvetica-Bold').text('Address: ', { continued: true }).font('Helvetica').text(order.address);
          doc.font('Helvetica-Bold').text('Zip code: ', { continued: true }).font('Helvetica').text(order.zip_code);
          doc.font('Helvetica-Bold').text('City: ', { continued: true }).font('Helvetica').text(order.city);
          doc.font('Helvetica-Bold').text('State: ', { continued: true }).font('Helvetica').text(order.state);
          doc.font('Helvetica-Bold').text('Item Id: ', { continued: true }).font('Helvetica').text(order.item_id);
          doc.font('Helvetica-Bold').text('Amount: ', { continued: true }).font('Helvetica').text(order.price);
          doc.font('Helvetica-Bold').text('Quantity: ', { continued: true }).font('Helvetica').text(order.quantity);
          doc.font('Helvetica-Bold').text('Status: ', { continued: true }).font('Helvetica').text(order.status);
          doc.font('Helvetica-Bold').text('Order Date: ', { continued: true }).font('Helvetica').text(order.created_at);
          doc.moveDown();
        });
      } else {
        doc.fontSize(16).text('Order id did not match', { align: 'center' });
      }
      
      // Finalize the PDF and end the stream
      doc.end();
    } catch (error) {
      console.error('Error generating PDF:', error);
      res.status(500).send('Error generating PDF');
    }
}
export async function changeOrderStatus(req,res,newStatus,orderId) {
try {
    if(newStatus && orderId){
        const changingStatus=await db.query("SELECT * FROM orders WHERE order_id=$1",[orderId])
        const result=changingStatus.rows[0];
        if(result>0){
            await db.query("UPDATE orders SET status=$1 WHERE order_id=$2",[newStatus,orderId]);
            console.log("Status successfully changed");
            res.render("orderDetails.ejs",{
                order_data:result,
                toastForNewsLetter: true
            })
        }else{
            console.log("no order found");
            res.render("orderDetails.ejs",{
                order_data:result,
                toastForNewsLetter: false
            })
        }
    }else{
        console.log("New Status or order id missing");
        res.render("orderDetails.ejs",{
            order_data:[],
            toastForNewsLetter: false
        })
    }
} catch (error) {
    console.log("Changing order status failed",error);
    res.render("orderDetails.ejs",{
        order_data:[],
        toastForNewsLetter: false
    })
}    
}
export async function invoiceGeneration(req, res, customer_data, items) {
  try {
      const doc = new PDFDocument({ 
          margin: 50,
          size: 'A4'
      });

      // Set headers for PDF download
      res.setHeader('Content-disposition', 'attachment; filename=Invoice_VSA.pdf');
      res.setHeader('Content-type', 'application/pdf');
      doc.pipe(res);

      // Add some styling constants for consistent spacing
      const pageWidth = doc.page.width - 100; // Accounting for margins
      const lineHeight = 20;
      const tablePadding = 10;

      // Helper function to draw a bordered box with optional background
      function drawBox(x, y, width, height, options = {}) {
          if (options.fill) {
              doc.fillColor(options.fill)
                 .rect(x, y, width, height)
                 .fill();
          }
          if (options.stroke) {
              doc.strokeColor(options.stroke)
                 .rect(x, y, width, height)
                 .stroke();
          } else {
              doc.strokeColor('#333333')
                 .rect(x, y, width, height)
                 .stroke();
          }
          doc.fillColor('#000000'); // Reset fill color to black
      }

      // Add a decorative header with company branding
      drawBox(50, 50, pageWidth, 80, { fill: '#f0f0f0', stroke: '#cccccc' });
      
      // Company Logo and Header
      doc.fontSize(24)
         .font('Helvetica-Bold')
         .fillColor('#2563eb') // Blue color for header
         .text('Vaibhav Skating Academy', 100, 75, { align: 'center', width: pageWidth - 100 });
      
      doc.fontSize(14)
         .font('Helvetica')
         .fillColor('#666666') // Dark gray for subtitle
         .text('Excellence in Skating Education', 100, 105, { align: 'center', width: pageWidth - 100 })
         .fillColor('#000000'); // Reset to black
      
      // INVOICE title
      const invoiceY = 160;
      doc.fontSize(20)
         .font('Helvetica-Bold')
         .text('INVOICE', 50, invoiceY, { align: 'center', width: pageWidth })
         .moveDown();

      // Add invoice details in a box
      const invoiceDetailsY = invoiceY + 40;
      const invoiceDetailsHeight = 80;
      drawBox(50, invoiceDetailsY, pageWidth, invoiceDetailsHeight, { fill: '#f8f9fa', stroke: '#dee2e6' });
      
      doc.fontSize(12)
         .font('Helvetica')
         .text(`Invoice Date: ${new Date().toLocaleDateString()}`, 70, invoiceDetailsY + 15)
         .text(`Invoice #: INV-${Date.now().toString().substring(8)}`, 70, invoiceDetailsY + 35)
         .text(`Payment Method: Direct`, 70, invoiceDetailsY + 55);

      // Create two columns for customer and business details
      const detailsY = invoiceDetailsY + invoiceDetailsHeight + 30;
      const detailsHeight = 160;
      const columnWidth = pageWidth / 2 - 10;
      
      // Left Column - Customer Details box
      drawBox(50, detailsY, columnWidth, detailsHeight, { stroke: '#dee2e6' });
      
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .text('Customer Details', 70, detailsY + 15, { width: columnWidth - 40 });
      
      doc.fontSize(11)
         .font('Helvetica')
         .text(`Name: ${customer_data.full_name}`, 70, detailsY + 40, { width: columnWidth - 40 })
         .text(`Email: ${customer_data.email}`, 70, detailsY + 60, { width: columnWidth - 40 })
         .text(`Mobile: ${customer_data.mobile_number}`, 70, detailsY + 80, { width: columnWidth - 40 });

      // Right Column - Business Details box
      const rightColumnX = 50 + columnWidth + 20;
      drawBox(rightColumnX, detailsY, columnWidth, detailsHeight, { stroke: '#dee2e6' });
      
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .text('Business Details', rightColumnX + 20, detailsY + 15, { width: columnWidth - 40 });
      
      doc.fontSize(10)
         .font('Helvetica')
         .text('Vaibhav Skating Academy', rightColumnX + 20, detailsY + 40, { width: columnWidth - 40 })
         .text('Near Dali Baba Mandir,', rightColumnX + 20, detailsY + 60, { width: columnWidth - 40 })
         .text('beside Kali Mata Mandir,', rightColumnX + 20, detailsY + 75, { width: columnWidth - 40 })
         .text('Agrawal Bhawan, Ram Gopal Colony', rightColumnX + 20, detailsY + 90, { width: columnWidth - 40 })
         .text('Raghurajnagar, Satna', rightColumnX + 20, detailsY + 105, { width: columnWidth - 40 })
         .text('Phone: +91-9301139998', rightColumnX + 20, detailsY + 125, { width: columnWidth - 40 });

      // Item Details Table
      const tableY = detailsY + detailsHeight + 40;
      doc.fontSize(16)
         .font('Helvetica-Bold')
         .text('Item Details', 50, tableY - 30, { underline: true });

      // Table configuration
      const tableHeaders = ['Item Name', 'Item ID', 'Price', 'Total'];
      const columnWidths = [pageWidth * 0.4, pageWidth * 0.2, pageWidth * 0.2, pageWidth * 0.2];
      let totalAmount = 0;

      // Draw table header background
      drawBox(50, tableY, pageWidth, lineHeight + tablePadding, { 
          fill: '#2563eb', 
          stroke: '#2563eb' 
      });

      // Draw table headers
      let xPosition = 40;
      tableHeaders.forEach((header, i) => {
          doc.fontSize(12)
             .font('Helvetica-Bold')
             .fillColor('#ffffff') // White text for header
             .text(header, xPosition + tablePadding/2, tableY + tablePadding/2, 
                  { width: columnWidths[i] - tablePadding, align: 'center' });
          xPosition += columnWidths[i];
      });
      
      doc.fillColor('#000000'); // Reset to black

      // Draw table rows with alternating background colors
      let yPosition = tableY + lineHeight + tablePadding;
      items.forEach((item, index) => {
          const rowHeight = lineHeight + tablePadding;
          const isEvenRow = index % 2 === 0;
          
          // Draw row background
          drawBox(50, yPosition, pageWidth, rowHeight, { 
              fill: isEvenRow ? '#f8f9fa' : '#ffffff',
              stroke: '#dee2e6'
          });
          
          const itemTotal = parseFloat(item.price);
          totalAmount += itemTotal;
          
          xPosition = 40;
          doc.fontSize(11)
             .font('Helvetica')
             .text(item.item_name, xPosition + tablePadding/2, yPosition + tablePadding/2, 
                  { width: columnWidths[0] - tablePadding, align: 'left' });
          
          xPosition += columnWidths[0];
          doc.text(item.item_id, xPosition + tablePadding/2, yPosition + tablePadding/2, 
                  { width: columnWidths[1] - tablePadding, align: 'center' });
          
          xPosition += columnWidths[1];
          doc.text(`₹${item.price}`, xPosition + tablePadding/2, yPosition + tablePadding/2, 
                  { width: columnWidths[2] - tablePadding, align: 'right' });
          
          xPosition += columnWidths[2];
          doc.text(`₹${itemTotal.toFixed(2)}`, xPosition + tablePadding/2, yPosition + tablePadding/2, 
                  { width: columnWidths[3] - tablePadding, align: 'right' });
          
          yPosition += rowHeight;
      });

      // Add total amount with background - ensuring enough space for decimal places
      const totalY = yPosition + 20;
      const totalBoxWidth = columnWidths[3] + 10; // Extra padding to ensure text fits
      drawBox(60 + pageWidth - totalBoxWidth, totalY, totalBoxWidth, lineHeight + tablePadding, {
          fill: '#f0f0f0',
          stroke: '#333333'
      });
      
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .text(`Total: ₹${totalAmount.toFixed(2)}`, 
              50 + pageWidth - totalBoxWidth + tablePadding/2, 
              totalY + tablePadding/2, 
              { width: totalBoxWidth - tablePadding, align: 'right' });

      // Add footer with a subtle divider line
      const footerY = doc.page.height - 100;
      
      doc.moveTo(50, footerY)
         .lineTo(50 + pageWidth, footerY)
         .strokeColor('#cccccc')
         .stroke();
         
      doc.fontSize(10)
         .font('Helvetica')
         .fillColor('#666666')
         .text('Thank you for your business!', 50, footerY + 20, { align: 'center', width: pageWidth })
         .moveDown(0.5)
         .text('This is a computer-generated invoice.', { align: 'center', width: pageWidth })
         .moveDown(0.5)
         .text('For any queries, contact us at vaibhavskatingacademy@gmail.com', { align: 'center', width: pageWidth });

      doc.end();
      console.log('PDF generation complete');
      return true;

  } catch (error) {
      console.error('Error generating PDF:', error);
      res.status(500).send('Error generating PDF');
      return false;
  }
}
export async function billGeneration(req, res, customer_data, items) {
  try {
      const doc = new PDFDocument({ 
          margin: 50,
          size: 'A4'
      });

      // Set headers for PDF download
      res.setHeader('Content-disposition', 'attachment; filename=Bill_VSA.pdf');
      res.setHeader('Content-type', 'application/pdf');
      doc.pipe(res);

      // Add some styling constants for consistent spacing
      const pageWidth = doc.page.width - 100; // Accounting for margins
      const lineHeight = 20;
      const tablePadding = 10;

      // Helper function to draw a bordered box with optional background
      function drawBox(x, y, width, height, options = {}) {
          if (options.fill) {
              doc.fillColor(options.fill)
                 .rect(x, y, width, height)
                 .fill();
          }
          if (options.stroke) {
              doc.strokeColor(options.stroke)
                 .rect(x, y, width, height)
                 .stroke();
          } else {
              doc.strokeColor('#333333')
                 .rect(x, y, width, height)
                 .stroke();
          }
          doc.fillColor('#000000'); // Reset fill color to black
      }

      // Add a decorative header with company branding
      drawBox(50, 50, pageWidth, 80, { fill: '#f0f0f0', stroke: '#cccccc' });
      
      // Company Logo and Header
      doc.fontSize(24)
         .font('Helvetica-Bold')
         .fillColor('#2563eb') // Blue color for header
         .text('Vaibhav Skating Academy', 100, 75, { align: 'center', width: pageWidth - 100 });
      
      doc.fontSize(14)
         .font('Helvetica')
         .fillColor('#666666') // Dark gray for subtitle
         .text('Excellence in Skating Education', 100, 105, { align: 'center', width: pageWidth - 100 })
         .fillColor('#000000'); // Reset to black
      
      // INVOICE title
      const invoiceY = 160;
      doc.fontSize(20)
         .font('Helvetica-Bold')
         .text('Bill', 50, invoiceY, { align: 'center', width: pageWidth })
         .moveDown();

      // Add invoice details in a box
      const invoiceDetailsY = invoiceY + 40;
      const invoiceDetailsHeight = 80;
      drawBox(50, invoiceDetailsY, pageWidth, invoiceDetailsHeight, { fill: '#f8f9fa', stroke: '#dee2e6' });
      
      doc.fontSize(12)
         .font('Helvetica')
         .text(`Invoice Date: ${new Date().toLocaleDateString()}`, 70, invoiceDetailsY + 15)
         .text(`Invoice #: INV-${Date.now().toString().substring(8)}`, 70, invoiceDetailsY + 35)
         .text(`Payment Method: Direct`, 70, invoiceDetailsY + 55);

      // Create two columns for customer and business details
      const detailsY = invoiceDetailsY + invoiceDetailsHeight + 30;
      // FIXED: Increased the height to prevent text overflow
      const detailsHeight = 160;
      const columnWidth = pageWidth / 2 - 10;
      
      // Left Column - Customer Details box
      drawBox(50, detailsY, columnWidth, detailsHeight, { stroke: '#dee2e6' });
      
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .text('Customer Details', 70, detailsY + 15, { width: columnWidth - 40 });
      
      doc.fontSize(11)
         .font('Helvetica')
         .text(`Name: ${customer_data.full_name}`, 70, detailsY + 40, { width: columnWidth - 40 })
         .text(`Email: ${customer_data.email}`, 70, detailsY + 60, { width: columnWidth - 40 })
         .text(`Mobile: ${customer_data.mobile_number}`, 70, detailsY + 80, { width: columnWidth - 40 });

      // Right Column - Business Details box
      const rightColumnX = 50 + columnWidth + 20;
      drawBox(rightColumnX, detailsY, columnWidth, detailsHeight, { stroke: '#dee2e6' });
      
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .text('Business Details', rightColumnX + 20, detailsY + 15, { width: columnWidth - 40 });
      
      // FIXED: Reduced font size and added line breaks to prevent text overlap
      doc.fontSize(10)
         .font('Helvetica')
         .text('Vaibhav Skating Academy', rightColumnX + 20, detailsY + 40, { width: columnWidth - 40 })
         .text('Near Dali Baba Mandir,', rightColumnX + 20, detailsY + 60, { width: columnWidth - 40 })
         .text('beside Kali Mata Mandir,', rightColumnX + 20, detailsY + 75, { width: columnWidth - 40 })
         .text('Agrawal Bhawan, Ram Gopal Colony', rightColumnX + 20, detailsY + 90, { width: columnWidth - 40 })
         .text('Raghurajnagar, Satna', rightColumnX + 20, detailsY + 105, { width: columnWidth - 40 })
         .text('Phone: +91-9301139998', rightColumnX + 20, detailsY + 125, { width: columnWidth - 40 });

      // Item Details Table
      const tableY = detailsY + detailsHeight + 40;
      doc.fontSize(16)
         .font('Helvetica-Bold')
         .text('Item Details', 50, tableY - 30, { underline: true });

      // Table configuration
      const tableHeaders = ['Item Name', 'Item ID', 'Price', 'Total'];
      const columnWidths = [pageWidth * 0.4, pageWidth * 0.2, pageWidth * 0.2, pageWidth * 0.2];
      let totalAmount = 0;

      // Draw table header background
      drawBox(50, tableY, pageWidth, lineHeight + tablePadding, { 
          fill: '#2563eb', 
          stroke: '#2563eb' 
      });

      // Draw table headers
      let xPosition = 50;
      tableHeaders.forEach((header, i) => {
          doc.fontSize(12)
             .font('Helvetica-Bold')
             .fillColor('#ffffff') // White text for header
             .text(header, xPosition + tablePadding/2, tableY + tablePadding/2, 
                  { width: columnWidths[i] - tablePadding, align: 'center' });
          xPosition += columnWidths[i];
      });
      
      doc.fillColor('#000000'); // Reset to black

      // Draw table rows with alternating background colors
      let yPosition = tableY + lineHeight + tablePadding;
      items.forEach((item, index) => {
          const rowHeight = lineHeight + tablePadding;
          const isEvenRow = index % 2 === 0;
          
          // Draw row background
          drawBox(50, yPosition, pageWidth, rowHeight, { 
              fill: isEvenRow ? '#f8f9fa' : '#ffffff',
              stroke: '#dee2e6'
          });
          
          const itemTotal = parseFloat(item.price);
          totalAmount += itemTotal;
          
          xPosition = 40;
          doc.fontSize(11)
             .font('Helvetica')
             .text(item.item_name, xPosition + tablePadding/2, yPosition + tablePadding/2, 
                  { width: columnWidths[0] - tablePadding, align: 'left' });
          
          xPosition += columnWidths[0];
          doc.text(item.item_id, xPosition + tablePadding/2, yPosition + tablePadding/2, 
                  { width: columnWidths[1] - tablePadding, align: 'center' });
          
          xPosition += columnWidths[1];
          doc.text(`₹${item.price}`, xPosition + tablePadding/2, yPosition + tablePadding/2, 
                  { width: columnWidths[2] - tablePadding, align: 'right' });
          
          xPosition += columnWidths[2];
          doc.text(`₹${itemTotal.toFixed(2)}`, xPosition + tablePadding/2, yPosition + tablePadding/2, 
                  { width: columnWidths[3] - tablePadding, align: 'right' });
          
          yPosition += rowHeight;
      });

      // FIXED: Increased the total box width and padding to fit total amount with decimals
      const totalY = yPosition + 20;
      // Extra padding to ensure the total amount doesn't overflow
      const totalBoxWidth = columnWidths[3] + 12;
      drawBox(60 + pageWidth - totalBoxWidth, totalY, totalBoxWidth, lineHeight + tablePadding, {
          fill: '#f0f0f0',
          stroke: '#333333'
      });
      
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .text(`Total: ₹${totalAmount.toFixed(2)}`, 
              50 + pageWidth - totalBoxWidth + tablePadding/2, 
              totalY + tablePadding/2, 
              { width: totalBoxWidth - tablePadding, align: 'right' });

      // Add footer with a subtle divider line
      const footerY = doc.page.height - 100;
      
      doc.moveTo(50, footerY)
         .lineTo(50 + pageWidth, footerY)
         .strokeColor('#cccccc')
         .stroke();
         
      doc.fontSize(10)
         .font('Helvetica')
         .fillColor('#666666')
         .text('Thank you for your business!', 50, footerY + 20, { align: 'center', width: pageWidth })
         .moveDown(0.5)
         .text('This is a computer-generated invoice.', { align: 'center', width: pageWidth })
         .moveDown(0.5)
         .text('For any queries, contact us at vaibhavskatingacademy@gmail.com', { align: 'center', width: pageWidth });

      doc.end();
      return true;

  } catch (error) {
      console.error('Error generating PDF:', error);
      res.status(500).send('Error generating PDF');
      return false;
  }
}

// Helper function to sum array values (needed for table width calculation)
function sum(arr) {
  return arr.reduce((a, b) => a + b, 0);
}
// export async function addingNewItemInShop(itemsImage,itemsImage1,itemsImage2,itemsName,itemsDescription,itemsItemId,itemsPrice,itemsQuantity,itemsItemType) {
//     try {
//         const data=await db.query(`SELECT * FROM stock_${itemsItemType} WHERE item_id=$1`,[itemsItemId]);
//         const result=data.rows[0];
//         if(result){
//             res.send("item id already in use kindly use another id");
//             console.log("item id already in use worng item id entered");
//             return false;
//         }else{
//             await db.query(`INSERT INTO stock_${itemsItemType} (img,name,description,item_id,price,quantity,item_type) VALUES($1,$2,$3,$4,$5,$6,$7)`,[itemsImage,itemsName,itemsDescription,itemsItemId,itemsPrice,itemsQuantity,itemsItemType]);
//             console.log("item successfully added");
//             await db.query(`INSERT INTO product_details (img,img1,img2,item_id) VALUES($1,$2,$3,$4)`,[itemsImage,itemsImage1,itemsImage2,itemsItemId]);
//             console.log("item successfully added in product details");            
//             return true;            
//         }
//     } catch (error) {

//         console.log("Cannot add new item",error);
//         return false;
//     }
// }

export async function newStudent(req, res, Student_Name, Father_name, Mother_name, mobile_number, email, groupAddedOn, skate_type, feePaid,feeStructure) {
  try {
      if (Student_Name && Father_name && Mother_name && mobile_number && email && groupAddedOn && skate_type && feePaid && feeStructure) {
          // Check if the student already exists
          const result = await db.query("SELECT * FROM students WHERE student_name=$1 AND father_name=$2 AND mother_name=$3", [Student_Name, Father_name, Mother_name]);

          if (result.rows.length > 0) {
              console.log("Student already exists in the database");
              return 'e'; // Student exists
          } else {
              // Insert new student
              const response = await db.query(
                  "INSERT INTO students (student_name, father_name, mother_name, mobile_number, email, groupAddedOn, skate_type, feePaid,dateOfPaying,feeStructure) VALUES ($1, $2, $3, $4, $5, $6, $7, $8,$9,$10)",
                  [Student_Name, Father_name, Mother_name, mobile_number, email, groupAddedOn, skate_type, feePaid,new Date(),feeStructure]
              );

              //date is set to default current date and will be set automatically so no need to pass it.

              if (response.rowCount > 0) {
                  console.log("Student registered and details added to the database");
                  return true; // Successfully added
              } else {
                  console.log("Student not registered and details not added to the database");
                  return false; // Failed to add
              }
          }
      } else {
          console.log("Incomplete student data");
          return false; // Incomplete data
      }
  } catch (error) {
      console.log("Error adding student:", error);
      return false; // Error during process
  }
}

export async function attendanceDetails(req, res, studentData) {
  try {
    // Create a new PDF document
    const doc = new PDFDocument({ margin: 30 });

    // Set response headers
    res.setHeader('Content-disposition', 'attachment; filename=Attendance_list_VSA.pdf');
    res.setHeader('Content-type', 'application/pdf');

    // Pipe the PDF document to the response
    doc.pipe(res);

    // Add title to the PDF
    doc.fontSize(20).text('Attendance List VSA', { align: 'center' }).moveDown(1);

    // Add date
    doc.fontSize(12).text(`Date: ${new Date().toLocaleDateString()}`, { align: 'right' }).moveDown(1);

    // Define table settings
    const tableTop = 120;
    const studIdWidth = 100;
    const nameWidth = 150;
    const motherNameWidth = 150;
    const statusWidth = 100;
    const dateWidth = 100;
    const tableWidth = studIdWidth + nameWidth + motherNameWidth + statusWidth + dateWidth;
    const rowHeight = 20;

    // Draw table headers
    doc.fontSize(11).font('Helvetica-Bold')
      .text('Student ID', 30, tableTop, { width: studIdWidth, align: 'left' })
      .text('Student Name', 30 + studIdWidth, tableTop, { width: nameWidth, align: 'left' })
      .text('Mother\'s Name', 30 + studIdWidth + nameWidth, tableTop, { width: motherNameWidth, align: 'left' })
      .text('Status', 30 + studIdWidth + nameWidth + motherNameWidth, tableTop, { width: statusWidth, align: 'left' })
      .text('Attendance Date', 30 + studIdWidth + nameWidth + motherNameWidth + statusWidth, tableTop, { width: dateWidth, align: 'left' });

    // Draw header underline
    doc.moveTo(30, tableTop + rowHeight).lineTo(30 + tableWidth, tableTop + rowHeight).stroke();

    // Draw rows
    studentData.forEach((attendance, i) => {
      const y = tableTop + (i + 1) * rowHeight;
      const fillColor = i % 2 === 0 ? '#f0f0f0' : '#ffffff';

      // Draw row background color
      doc.rect(30, y, tableWidth, rowHeight).fill(fillColor).stroke();

      // Format the date properly for display
      const formattedDate = new Date(attendance.attendance_date).toLocaleDateString();

      doc.fontSize(12).font('Helvetica')
        .fillColor('#000000')
        .text(attendance.stud_id, 30, y + 5, { width: studIdWidth, align: 'left' })
        .text(attendance.student_name, 30 + studIdWidth, y + 5, { width: nameWidth, align: 'left' })
        .text(attendance.mother_name, 30 + studIdWidth + nameWidth, y + 5, { width: motherNameWidth, align: 'left' })
        .text(attendance.status, 30 + studIdWidth + nameWidth + motherNameWidth, y + 5, { width: statusWidth, align: 'left' })
        .text(formattedDate, 30 + studIdWidth + nameWidth + motherNameWidth + statusWidth, y + 5, { width: dateWidth, align: 'left' });
    });

    // Add footer
    const footerText = 'Generated by VSA Inventory System';
    doc.fontSize(10).fillColor('#888888')
      .text(footerText, 30, doc.page.height - 30, { align: 'center' });

    // Finalize the PDF and end the stream
    doc.end();
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).send('Error generating PDF');
  }
}
