import nodemailer from "nodemailer";
    const transporter = nodemailer.createTransport({
        host: "smtpout.secureserver.net",
        port: 465,
        secure: true, // true for 465, false for other ports
        auth: {
            user: '', // your GoDaddy email
            pass: '' // your GoDaddy email password
        }
    });

const sendNewsletter = (email, subject, message) => {
    const mailOptions = {
        from: 'your-email@your-domain.com',
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
export default sendNewsletter();;