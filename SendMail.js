//this is a mock and is not used
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
    service: 'gmail', // You can use other services too like Outlook, SMTP etc.
    auth: {
      user: "", // Your email
      pass: ""// Your email password or app password
    }
  });

const sendNewsletter = (email, subject, message) => {
    const mailOptions = {
        from:"archit.uhr75@gmail.com",
        to: email,
        subject: subject,
        text: message
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.log(`Error: ${error}`);
        } else {
            console.log(`Email sent: ${info.response}`);
        }
    });
};

export default sendNewsletter;
