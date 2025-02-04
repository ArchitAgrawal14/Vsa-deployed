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
                .text(item.price, margin + colWidths.email + colWidths.name + colWidths.mobile + colWidths.itemId, y + 5, { width: colWidths.price, align: 'left' })
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
      
      // Add logo placeholder (you can add your actual logo)
      doc.fontSize(10)
         .text('VSA', 50, 50, { align: 'left' });
      
      // Invoice title with styling
      doc.fontSize(28)
         .font('Helvetica-Bold')
         .text('INVOICE', 50, 50, { align: 'right' });
      
      // Add horizontal line
      doc.moveTo(50, 90)
         .lineTo(550, 90)
         .stroke();
      
      // Customer Details Section
      doc.fontSize(16)
         .font('Helvetica-Bold')
         .text('Bill To:', 50, 110);
      
      doc.fontSize(12)
         .font('Helvetica')
         .text(customer_data.full_name, 50, 135)
         .text(`Email: ${customer_data.email}`, 50, 155)
         .text(`Mobile: ${customer_data.mobile_number}`, 50, 175);
      
      // Invoice Details (right side)
      const currentDate = new Date().toLocaleDateString();
      doc.fontSize(12)
         .font('Helvetica')
         .text(`Invoice Date: ${currentDate}`, 350, 135);
        //  .text(`Invoice #: INV-${Date.now().toString().slice(-6)}`, 350, 155);
      
      // Items Table
      const tableTop = 230;
      const tableHeaders = ['Item Name', 'Item ID', 'Price', 'Total'];
      const tableColumnWidths = [220, 100, 90, 90]; // Adjusted column widths
      const tableWidth = tableColumnWidths.reduce((sum, width) => sum + width, 0);
      
      // Draw table headers with background
      doc.fillColor('#2B2B2B')
         .rect(50, tableTop, tableWidth, 30)
         .fill();
      
      doc.fillColor('white')
         .fontSize(12)
         .font('Helvetica-Bold');
      
      let xPosition = 50;
      tableHeaders.forEach((header, i) => {
          doc.text(header, xPosition + 5, tableTop + 10, {
              width: tableColumnWidths[i] - 10,
              align: 'center'
          });
          xPosition += tableColumnWidths[i];
      });
      
      // Draw table rows
      let yPosition = tableTop + 30;
      doc.fillColor('black')
         .font('Helvetica');
      
      let totalAmount = 0;
      
      items.forEach((item, index) => {
          const rowHeight = 30;
          const itemTotal = parseFloat(item.price);
          totalAmount += itemTotal;
          
          // Add zebra striping
          if (index % 2 === 0) {
              doc.fillColor('#f6f6f6')
                 .rect(50, yPosition, tableWidth, rowHeight)
                 .fill();
          }
          
          doc.fillColor('black');
          xPosition = 50;
          
          // Item Name
          doc.text(item.item_name, xPosition + 5, yPosition + 10, {
              width: tableColumnWidths[0] - 10,
              align: 'left'
          });
          
          // Item ID
          doc.text(item.item_id, xPosition + tableColumnWidths[0] + 5, yPosition + 10, {
              width: tableColumnWidths[1] - 10,
              align: 'center'
          });
          
          // Price
          doc.text(`₹${item.price}`, xPosition + tableColumnWidths[0] + tableColumnWidths[1] + 5, yPosition + 10, {
              width: tableColumnWidths[2] - 10,
              align: 'right'
          });
          
          // Total
          doc.text(`₹${itemTotal.toFixed(2)}`, xPosition + tableColumnWidths[0] + tableColumnWidths[1] + tableColumnWidths[2] + 5, yPosition + 10, {
              width: tableColumnWidths[3] - 10,
              align: 'right'
          });
          
          yPosition += rowHeight;
      });
      
      // Add table border
      doc.rect(50, tableTop, tableWidth, yPosition - tableTop)
         .stroke();
      
      // Total Amount section with proper alignment
      const totalSection = {
          x: 50 + tableWidth - tableColumnWidths[2] - tableColumnWidths[3], // Align with last two columns
          width: tableColumnWidths[2] + tableColumnWidths[3],
          y: yPosition + 20
      };
      
      doc.fontSize(14)
         .font('Helvetica-Bold');
      
      // Total label (aligned with Price column)
      doc.text('Total Amount:', 
          totalSection.x, 
          totalSection.y, 
          { width: tableColumnWidths[2], align: 'right' }
      );
      
      // Total value (aligned with Total column)
      doc.text(`₹${totalAmount.toFixed(2)}`,
          totalSection.x + tableColumnWidths[2], 
          totalSection.y,
          { width: tableColumnWidths[3], align: 'right' }
      );
      
      // Add horizontal line
      doc.moveTo(50, yPosition + 50)
         .lineTo(550, yPosition + 50)
         .stroke();
      
      // Business Details
      const businessDetailsY = yPosition + 70;
      doc.fontSize(16)
         .font('Helvetica-Bold')
         .text('Vaibhav Skating Academy', 50, businessDetailsY);
      
      doc.fontSize(12)
         .font('Helvetica')
         .text('Near Dali Baba Mandir, beside Kali Mata Mandir,', 50, businessDetailsY + 25)
         .text('Agrawal Bhawan, Ram Gopal Colony Raghurajnagar, Satna', 50, businessDetailsY + 40)
         .text('Phone: +91-9301139998', 50, businessDetailsY + 55)
         .text('Email: vaibhavskatingacademy@gmail.com', 50, businessDetailsY + 70);
      
      // Add "Thank You" message
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .text('Thank you for your business!', 50, businessDetailsY + 100, { align: 'center' });
      
      doc.end();
      console.log('PDF generation complete');
      
  } catch (error) {
      console.error('Error generating PDF:', error);
      res.status(500).send('Error generating PDF');
  }
}
// export async function billGeneration(req, res, customer_data, items) {
//     try {
//         // console.log('Customer Data:', customer_data);
//         // console.log('Items:', items);

//         const doc = new PDFDocument();
        
//         // Set headers for PDF download
//         res.setHeader('Content-disposition', 'attachment; filename=Bill_VSA.pdf');
//         res.setHeader('Content-type', 'application/pdf');
        
//         // Pipe PDF to response
//         doc.pipe(res);
        
//         // Title
//         doc.fontSize(24).text('Invoice', { align: 'center' });
//         doc.moveDown();

//         // Customer Details
//         doc.fontSize(16).font('Helvetica-Bold').text('Customer Details', { underline: true });
//         doc.fontSize(12).font('Helvetica').text(`Name: ${customer_data.full_name}`);
//         doc.text(`Email: ${customer_data.email}`);
//         doc.text(`Mobile Number: ${customer_data.mobile_number}`);
//         doc.moveDown();

//         // Item Details Table
//         doc.fontSize(16).font('Helvetica-Bold').text('Item Details', { underline: true });
//         doc.moveDown();
        
//         const table = {
//             headers: ['Item Name', 'Item ID', 'Price', 'Total'],
//             rows: [],
//         };
        
//         let totalAmount = 0;
        
//         items.forEach(item => {
//             const itemTotal = parseFloat(item.price);
//             totalAmount += itemTotal;
//             table.rows.push([item.item_name, item.item_id, `₹${item.price}`, `₹${itemTotal.toFixed(2)}`]);
//         });

//         function drawTable(doc, table, startX, startY) {
//             const tableWidth = doc.page.width - startX * 2;
//             const headerHeight = 20;
//             const rowHeight = 20;
//             const fontSize = 10;
//             const cellPadding = 5;
            
//             doc.fontSize(fontSize).font('Helvetica-Bold');
//             table.headers.forEach((header, i) => {
//                 doc.text(header, startX + (tableWidth / table.headers.length) * i, startY, {
//                     width: tableWidth / table.headers.length,
//                     align: 'center',
//                 });
//             });

//             doc.moveDown(headerHeight / 2);

//             doc.font('Helvetica');
//             table.rows.forEach((row, i) => {
//                 row.forEach((cell, j) => {
//                     doc.text(cell, startX + (tableWidth / table.headers.length) * j, startY + headerHeight + i * rowHeight, {
//                         width: tableWidth / table.headers.length,
//                         align: 'center',
//                     });
//                 });
//                 doc.moveDown(rowHeight);
//             });

//             // Draw table border
//             doc.rect(startX, startY - headerHeight, tableWidth, headerHeight + table.rows.length * rowHeight).stroke();
//         }

//         drawTable(doc, table, 50, doc.y);
        
//         doc.moveDown();
//         doc.fontSize(14).font('Helvetica-Bold').text(`Total Amount: ₹${totalAmount.toFixed(2)}`, { align: 'left' });
//         doc.moveDown();
        
//         // Business Details
//         doc.fontSize(16).font('Helvetica-Bold').text('Business Details', { underline: true });
//         doc.fontSize(12).font('Helvetica').text('Business Name: Vaibhav Skating Academy');
//         doc.text('Address: Near Dali Baba Mandir, beside Kali Mata Mandir, Agrawal Bhawan, Ram Gopal Colony Raghurajnagar, Satna');
//         doc.text('Phone: +91-9301139998');
//         doc.text('Email: vaibhavskatingacademy@gmail.com');
        
//         doc.end();
//         console.log('PDF generation complete');
//         return true;
//     } catch (error) {
//         console.error('Error generating PDF:', error);
//         res.status(500).send('Error generating PDF');
//         return false;
//     }
// }

export async function billGeneration(req, res, customer_data, items) {
    try {
        const doc = new PDFDocument({ margin: 50 });

        // Set headers for PDF download
        res.setHeader('Content-disposition', 'attachment; filename=Bill_VSA.pdf');
        res.setHeader('Content-type', 'application/pdf');
        doc.pipe(res);

        // Company Logo and Header
        doc.fontSize(24)
           .font('Helvetica-Bold')
           .text('Vaibhav Skating Academy', { align: 'center' });
        
        doc.fontSize(20)
           .font('Helvetica')
           .text('INVOICE', { align: 'center' })
           .moveDown();

        // Create two columns for customer and business details
        const customerStartY = doc.y;
        
        // Left Column - Customer Details
        doc.fontSize(16)
           .font('Helvetica-Bold')
           .text('Customer Details', { continued: true, underline: true })
           .moveDown();

        doc.fontSize(12)
           .font('Helvetica')
           .text(`Name: ${customer_data.full_name}`)
           .text(`Email: ${customer_data.email}`)
           .text(`Mobile: ${customer_data.mobile_number}`)
           .moveDown();

        // Right Column - Business Details
        doc.fontSize(16)
           .font('Helvetica-Bold')
           .text('Business Details', { 
               underline: true,
               align: 'right',
               continued: true
           })
           .moveDown();

        const rightColumnX = doc.page.width - 200;
        const currentY = customerStartY + 30;

        doc.fontSize(12)
           .font('Helvetica')
           .text('Vaibhav Skating Academy', rightColumnX, currentY)
           .text('Near Dali Baba Mandir,', rightColumnX)
           .text('beside Kali Mata Mandir,', rightColumnX)
           .text('Agrawal Bhawan, Ram Gopal Colony', rightColumnX)
           .text('Raghurajnagar, Satna', rightColumnX)
           .text('Phone: +91-9301139998', rightColumnX)
           .text('Email: vaibhavskatingacademy@gmail.com', rightColumnX)
           .moveDown(2);

        // Item Details Table
        doc.fontSize(16)
           .font('Helvetica-Bold')
           .text('Item Details', { underline: true })
           .moveDown();

        // Table configuration
        const tableTop = doc.y;
        const tableHeaders = ['Item Name', 'Item ID', 'Price', 'Total'];
        const columnWidths = [200, 100, 100, 100];
        let totalAmount = 0;

        // Draw table headers
        let xPosition = 50;
        tableHeaders.forEach((header, i) => {
            doc.fontSize(12)
               .font('Helvetica-Bold')
               .text(header, xPosition, tableTop, { width: columnWidths[i], align: 'center' });
            xPosition += columnWidths[i];
        });

        // Draw table rows
        let yPosition = tableTop + 25;
        items.forEach((item, index) => {
            const itemTotal = parseFloat(item.price);
            totalAmount += itemTotal;
            
            xPosition = 50;
            doc.fontSize(11)
               .font('Helvetica')
               .text(item.item_name, xPosition, yPosition, { width: columnWidths[0], align: 'center' });
            
            xPosition += columnWidths[0];
            doc.text(item.item_id, xPosition, yPosition, { width: columnWidths[1], align: 'center' });
            
            xPosition += columnWidths[1];
            doc.text(`₹${item.price}`, xPosition, yPosition, { width: columnWidths[2], align: 'center' });
            
            xPosition += columnWidths[2];
            doc.text(`₹${itemTotal.toFixed(2)}`, xPosition, yPosition, { width: columnWidths[3], align: 'center' });
            
            yPosition += 20;
        });

        // Draw table borders
        doc.rect(50, tableTop - 5, sum(columnWidths), (items.length + 1) * 20 + 10).stroke();

        // Add total amount
        doc.moveDown(2)
           .fontSize(14)
           .font('Helvetica-Bold')
           .text(`Total Amount: ₹${totalAmount.toFixed(2)}`, { align: 'right' });

        // Add footer
        doc.fontSize(10)
           .font('Helvetica')
           .text('Thank you for your business!', { align: 'center' })
           .moveDown()
           .text('This is a computer-generated invoice', { align: 'center' });

        doc.end();
        return true;

    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).send('Error generating PDF');
        return false;
    }
}

// Helper function to sum array values
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
    doc.fontSize(12).font('Helvetica-Bold')
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
