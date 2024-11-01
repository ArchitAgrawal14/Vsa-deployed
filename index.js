import express, { query } from "express";
import bodyParser from "body-parser";
import * as admin from "./admin.js";
import Razorpay from "razorpay";
import cors from "cors";
import multer from "multer";
import nodemailer from "nodemailer";
import crypto from "crypto";
import pg from "pg";
import jwt from "jsonwebtoken";
import path from "path";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import axios from "axios";
import { fileURLToPath } from "url";
import { dirname } from "path";
import {  auth, OAuth2Client } from "google-auth-library";
import dotenv from 'dotenv';
import passport from 'passport';
import  './googleauth.js'; 
dotenv.config();
// import mysql from 'mysql2';
const app = express();
const _dirname = dirname(fileURLToPath(import.meta.url));
const port =process.env.SERVER_PORT;
// const port=3000;
// iss niche wala ko use kar sakte hai agar hum google ka oauth2 use karna ho toh.
const CLIENT_ID =
  process.env.googleClientId;
  const Client = new OAuth2Client(CLIENT_ID);

// const razorpay = new Razorpay({
//   key_id: process.env.razorPayKeyId, // Replace with your Razorpay key id
//   key_secret: process.env.razorPayKeySecret, // Replace with your Razorpay key secret
// });
app.use(passport.initialize());
app.set("view engine", "ejs");
app.set("views", _dirname + "/views"); // Set the path to the views directory
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(_dirname + "/public"));
// app.use(function(req,res,next){
//   res.setHeader('Access-Control-Allow-Origin','*');
//   res.setHeader('Access-Control-Allow-Methods','GET,POST,PUT,DELETE');
//   res.setHeader('Access-Control-Allow-Headers','Content-Type');
//   res.setHeader('Access-Control-Allow-Credentials','true');
// })
app.use((req, res, next) => {
  res.removeHeader('Cross-Origin-Opener-Policy');
  res.removeHeader('Cross-Origin-Embedder-Policy');
  next();
});

const Secret_key = process.env.jwtSecretKey;

// const db = new pg.Client({
//   host:process.env.databaseHost,
//   password: process.env.databasePassword,
//   database: "vsa",
//   port: 4000,
//   user: "postgres",
// });

//Database_url mei internal server ka link dala jaata hai
// const db = new pg.Client({
//   host: process.env.databaseHost,       // Fetch from env
//   user: process.env.DATABASE_USER,       // Fetch from env
//   password: process.env.databasePassword, // Fetch from env
//   database: process.env.DATABASE_NAME || "vsa",  // Fetch from env with a fallback
//   port: process.env.DATABASE_PORT || 4000 // Fetch from env with default 5432
// });
const db = new pg.Client({
  host: process.env.databaseHost,       // Fetch from env
  user: process.env.DATABASE_USER,       // Fetch from env
  password: process.env.databasePassword, // Fetch from env
  database: process.env.DATABASE_NAME || "vsa_hyuv",  // Fetch from env with a fallback
  port: process.env.DATABASE_PORT || 5432 // Fetch from env with default 5432
});

// Connect to the database
// connection.connect((err) => {
//   if (err) {
//     console.error('Error connecting to the database:', err.stack);
//     return;
//   }
//   console.log('Connected to the database as id ' + connection.threadId);
// });

// export default connection;

// below is the middle ware to prevent caching of authenticated pages iske wajah se back button dabane per re logged in page pe nhi jayega

app.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
app.use(cors(
  {origin:"http://localhost:3000",
      credentials:true,
      allowHeaders:"Content-Type"
  }
));
  
app.options("/google", cors());
app.get("/google", cors(), passport.authenticate("google",{
  
      scope:['profile']
  
}));

//Header part endpoints starts here
//this below is for signup

app.post("/SignUp", async (req, res) => {
    const { FullName, SignUp_Email, SignUp_Password, Mobile_number } = req.body;
    const saltRounds = 10;
    try {
      // Hashing the password
      const salt = await bcrypt.genSalt(saltRounds);
      const hashedPassword = await bcrypt.hash(SignUp_Password, salt);
      const firstName = FullName.split(" ")[0];    
      // Check if the email already exists in the database
      // console.log(SignUp_Email);
      const duplicateCheck = await db.query(
        `SELECT * FROM users WHERE email=$1;`,
        [SignUp_Email]
      );
      console.log("Duplicate check result:", duplicateCheck.rows);
  
      if (duplicateCheck.rows.length > 0) {
        res.render("login.ejs", { signUp_ToolTip: true });
        console.log("Duplicate email found");
      } else {
        // Generate email verification token
        const verificationToken = crypto.randomBytes(32).toString('hex');
  
        // Insert user with verification token and 'isVerified' flag set to false
        await db.query(
          "INSERT INTO users (full_name, email, password_entered, mobile_number,admin, verification_token, is_verified) VALUES ($1, $2, $3, $4, $5, $6,$7)",
          [FullName, SignUp_Email, hashedPassword, Mobile_number,false, verificationToken, false]
        );
  
        // Send verification email
        const transporter = nodemailer.createTransport({
          service: 'gmail', // You can use other services too like Outlook, SMTP etc.
          auth: {
            user: process.env.nodeMailerEmailValidatorEmail, // Your email
            pass: process.env.nodeMailerEmailValidatorPass  // Your email password or app password
          }
        });
  
        // const verificationLink = `http://localhost:3000/verify-email?token=${verificationToken}`;
        const verificationLink = `https://vsa-deployed.onrender.com/verify-email?token=${verificationToken}`;

        const mailOptions = {
          from: process.env.nodeMailerEmailValidatorEmail,
          to: SignUp_Email,
          subject: 'Verify your email for sign-up',
          html: `<p>Hi ${firstName},</p>
                 <p>Please click the link below to verify your email:</p>
                 <a href="${verificationLink}">Verify Email</a>`
        };
  
        await transporter.sendMail(mailOptions);
  
        // Inform the user to check their email for verification
        res.render("login.ejs", {
          signUp_ToolTip: false,
          // infoMessage: "Check your email to verify your account."
        });
        console.log("User added to database and verification email sent.");
  
      }
    } catch (error) {
      console.error("Error during sign up:", error);
      res.render("login.ejs", {
        errorMessage: "An error occurred during sign up, please try again."
      });
    }
});

//this below is after user clicks on the link sent to their email
app.get("/verify-email", async (req, res) => {
  const { token } = req.query;

  try {
      const result = await db.query(
          `SELECT * FROM users WHERE verification_token=$1 AND is_verified=false`,
          [token]
      );

      if (result.rows.length > 0) {
          await db.query(
              `UPDATE users SET is_verified=true WHERE verification_token=$1`,
              [token]
          );

          // Render the success page
          res.render("verificationSuccesspage.ejs", {
              message: "Your email has been verified successfully! You can now log in.",
              redirectTo: "/newLogin",
              delay: 2000 // Delay in milliseconds before redirecting
          });
      } else {
          // Render the failure page
          res.render("verificationFailure.ejs", {
              message: "Email verification failed. Please try again.",
              redirectTo: "/newLogin",
              delay: 2500 // Delay in milliseconds before redirecting
          });
      }
  } catch (error) {
      console.error("Error during email verification:", error);
      // Render the failure page
      res.render("verificationFailure", {
          message: "Email verification failed. Please try again.",
          redirectTo: "/newLogin",
          delay: 2500 // Delay in milliseconds before redirecting
      });
  }
});

app.post("/Login", async (req, res) => {
    const { Email, Password } = req.body;
    try {
      const enteredDetails = await db.query("SELECT * FROM users WHERE email=$1;", [Email]);
      if (enteredDetails.rows.length > 0) {
        const userCheck = enteredDetails.rows[0];
        if (userCheck.admin === true) {
          console.log("User is admin");
            const PassCheck = await bcrypt.compare(Password, userCheck.password_entered);
          if (PassCheck) {
            const firstName = userCheck.full_name.split(" ")[0];
            const token = jwt.sign(
              {
                Email: userCheck.email,
                fullName: userCheck.full_name,
                user_id: userCheck.id,
              },
              Secret_key,
              { expiresIn: "3d" }
            );
  
            res.cookie("token", token, { httpOnly: true, secure: true });
            console.log(token);
            admin.adminRole(req,res,firstName);
          } else {
            console.log("Invalid Credentials");
            res.render("login.ejs", {
              login_toolTip: true,
            });
          }
        } else {
          console.log("userCheck:", userCheck); // Debugging log
  
          const PassCheck = await bcrypt.compare(Password, userCheck.password_entered);
  
          if (PassCheck) {
            const firstName = userCheck.full_name.split(" ")[0];
            const token = jwt.sign(
              {
                Email: userCheck.email,
                fullName: userCheck.full_name,
                user_id: userCheck.id,
              },
              Secret_key,
              { expiresIn: "3d" }
            );
  
            res.cookie("token", token, { httpOnly: true, secure: true });
            console.log(token);
            res.render("index.ejs", {
              Login: firstName,
            });
          } else {
            console.log("Invalid Credentials");
            res.render("login.ejs", {
              login_toolTip: true,
            });
          }
        }
      } else {
        console.log("User does not exist");
        res.render("login.ejs", {
          login_toolTip1: true,
        });
      }
    } catch (error) {
      console.error("Error logging in:", error);
      res.render("login.ejs", {
        errorMessage: "An error occurred, please try again.",
      });
    }
});

app.get("/newLogin", (req, res) => {
  res.render("login.ejs");
  console.log("Successfully rendered login page");
});
const authenticateUser = (req, res, next) => {
    const token = req.cookies.token;
  
    if (!token) {
      console.log("Token not found");
      req.user = null;
      // return res.status(401).send("Not authenticated");
      return next();
    }
  
    jwt.verify(token, Secret_key, (err, decoded) => {
      if (err) {
        console.error("Token verification failed:", err);
        return res.status(401).send("Invalid token");
      }
  
      // Attach decoded user information to the request object
      req.user = decoded;
      next();
    });
};
app.get("/", authenticateUser,async (req, res) => {
    if (req.user) {
      const firstName = req.user.fullName.split(" ")[0];
      const {rows:homePageData}=await db.query("SELECT * FROM home_page_data");
      res.render("index.ejs", {
        Login: firstName,
        homePageData:homePageData,
      });
  
      console.log(
        `Successfully opened Home with user logged in: ${req.user.fullName}`
      );
    } else {
      const {rows:homePageData}=await db.query("SELECT * FROM home_page_data");
      res.render("index.ejs", {
        Login: null,
        homePageData:homePageData,
      });
      console.log("Sucessfully opened Home without user logged in");
    }
});
app.get("/Shop", authenticateUser, async (req, res) => {
    if (req.user) {
      const firstName = req.user.fullName.split(" ")[0];
      try {
        const { rows: item_data } = await db.query("SELECT * FROM stock_skates");
        console.log(
          "Stocks successfully retrieved from database with user login"
        );
        res.render("Shop.ejs", {
          Login: firstName,
          items_data: item_data,
        });
        console.log(
          "Sucessfully opened shop with user log in and item displayed"
        );
      } catch (error) {
        console.log("Unable to retrive stock", error);
      }
    } else {
      const { rows: item_data } = await db.query("SELECT * FROM stock_skates");
      console.log(
        "Stocks successfully retrieved from database without user login"
      );
      res.render("Shop.ejs", {
        Login: null,
        items_data: item_data,
      });
      console.log("Sucessfully opened shop without user logged in");
    }
});

app.post("/payment_success", async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;
  
    // Verification of payment signature
    const hmac = crypto.createHmac("sha256", "YOUR_RAZORPAY_SECRET");
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const generated_signature = hmac.digest("hex");
  
    if (generated_signature === razorpay_signature) {
      // Payment verified
      try {
        // Find the order with the given Razorpay order ID and mark it as paid
        const order = await db.query("SELECT * FROM orders WHERE order_id = $1", [
          razorpay_order_id,
        ]);
  
        if (order.rows.length === 0) {
          return res
            .status(404)
            .json({ success: false, error: "Order not found" });
        }
  
        const orderDetails = order.rows[0];
        const { item_id, item_type, quantity } = orderDetails;
  
        // Update stock quantity
        await db.query(
          `UPDATE stock_${item_type} SET quantity = quantity - $1 WHERE item_id = $2`,
          [quantity, item_id]
        );
  
        // Update order status to 'completed'
        await db.query(
          "UPDATE orders SET status = 'completed', payment_id = $1 WHERE order_id = $2",
          [razorpay_payment_id, razorpay_order_id]
        );
  
        res.json({ success: true });
      } catch (error) {
        console.error("Error processing payment:", error);
        res.status(500).json({ success: false, error: "Database update failed" });
      }
    } else {
      res
        .status(400)
        .json({ success: false, error: "Signature verification failed" });
    }
});
// yaha pe buy karne ke liye hai.
// app.get("/Buy_Now", authenticateUser, async (req, res) => {
//     if (req.user) {
//       const firstName = req.user.fullName.split(" ")[0];
//       const purchasedItem = await db.query(
//         "SELECT * FROM orders WHERE email=$1",
//         [req.user.Email]
//       );
//       if (purchasedItem.rows.length > 0) {
//         res.render("checkOutPage.ejs", {
//           Login: firstName,
//           purchasing_item: purchasedItem,
//         });
//       }
//     }
// });
  
  // Endpoint to handle payment success  
app.post("/Buy_Now", authenticateUser, async (req, res) => {
    const { item_id, item_type, quantity } = req.body;
  
    if (!req.user) {
      console.log("User not logged in, unable to process purchase.");
      return res
        .status(401)
        .render("login.ejs", {
          message: "You must be logged in to purchase items.",
        });
    }
  
    try {
      // Check user details
      const user_check = await db.query("SELECT * FROM users WHERE email = $1", [
        req.user.Email,
      ]);
      const user_check_address = await db.query(
        "SELECT * FROM users_address WHERE email = $1",
        [req.user.Email]
      );
  
      if (user_check.rows.length === 0 || user_check_address.rows.length === 0) {
        console.log("User or address details not found.");
        return res
          .status(404)
          .json({ error: "User or address details not found." });
      }
  
      const { name: full_name, email, mobile_number } = user_check.rows[0];
      const { address, zip_code, city, state } = user_check_address.rows[0];
  
      // Check item stock
      const itemCheck = await db.query(
        `SELECT * FROM stock_${item_type} WHERE item_id = $1`,
        [item_id]
      );
  
      if (itemCheck.rows.length === 0) {
        console.log("Item not found.");
        return res.status(404).json({ error: "Item not found." });
      }
  
      const purchase = itemCheck.rows[0];
      const newQuantity = Math.min(parseInt(quantity), purchase.quantity);
  
      if (quantity > purchase.quantity) {
        console.log("Number of items exceeds stock limit.");
      }
  
      // Insert into orders with a pending status
      await db.query(
        "INSERT INTO orders (name, email, mobile_number, address, zip_code, city, state, item_id, item_type, price, quantity, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending')",
        [
          full_name,
          email,
          mobile_number,
          address,
          zip_code,
          city,
          state,
          item_id,
          item_type,
          purchase.price,
          newQuantity,
        ]
      );
  
      // Create Razorpay order
      const orderOptions = {
        amount: purchase.price * newQuantity, // amount in the smallest currency unit
        currency: "INR",
        receipt: `receipt_order_${item_id}_${Date.now()}`,
      };
  
      const order = await razorpay.orders.create(orderOptions);
  
  
      res.status(200).json({
        id: order.id,
        currency: order.currency,
        amount: order.amount,
        full_name,
        email,
        mobile_number,
        address,
      });
      
    } catch (error) {
      console.error("Error processing purchase:", error);
      res
        .status(500)
        .json({ error: "An error occurred while processing your purchase." });
    }
});

app.get("/CheckOut",authenticateUser,(req,res)=>{
  res.render("checkOutPage.ejs");
});

app.get("/productDetails", authenticateUser ,async (req, res) => {
  try {
    if (req.user) {
    const firstName = req.user.fullName.split(" ")[0];

    const { item_id, item_type } = req.query;

    // Log the incoming parameters
    console.log("Fetching product with ID:", item_id, "of type:", item_type);

    if (!item_id || !item_type) {
      console.error("Missing item_id or item_type in the request");
      return res.status(400).send("Bad Request: Missing item ID or type.");
    }

    // Fetch product details from the database
    const data = await db.query(`SELECT * FROM stock_${item_type} WHERE item_id=$1`, [item_id]);
    const result = data.rows;

    if (!result.length) {
      return res.status(404).send("Item not found");
    }

    res.render("product_Details.ejs", { itemDetails: result, Login: firstName });
  }else{
    const { item_id, item_type } = req.query;

    const data = await db.query(`SELECT * FROM stock_${item_type} WHERE item_id=$1`, [item_id]);
    const result = data.rows;

    if (!result.length) {
      return res.status(404).send("Item not found");
    }
    res.render("product_Details.ejs", { itemDetails: result, Login: null });
  }
  } catch (error) {
    console.error("Error fetching item for displaying product details:", error);
    res.status(500).send("An error occurred while fetching the item.");
  }
});

app.post("/productDetails", authenticateUser, async (req, res) => {
    try {
      if (req.user) {
        const { item_id, item_type } = req.body;
        const firstName = req.user.fullName.split(" ")[0];
        const data = await db.query(`SELECT * FROM stock_${item_type} WHERE item_id=$1`, [item_id]);
        const result = data.rows;
  
        if (!result.length) {
          return res.status(404).json({ success: false, message: "Item not found" });
        }
  
        res.json({ success: true, itemDetails: result, Login: firstName });
      } else {
        //displaying product details page even without user login
        const { item_id, item_type } = req.body;
        const data = await db.query(`SELECT * FROM stock_${item_type} WHERE item_id=$1`, [item_id]);
        const result = data.rows;
        res.json({ success: true, itemDetails: result, Login: null });
      }
    } catch (error) {
      console.error("Error occurred:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
});
  
// Function to handle fetching and rendering items indiviually
const renderItems = async (req, res, productType, tableName) => {
    const firstName = req.user ? req.user.fullName.split(" ")[0] : null;
    try {
      const { rows: item_data } = await db.query(`SELECT * FROM ${tableName}`);
      console.log(`Stocks successfully retrieved ${productType} from database ${req.user ? 'with' : 'without'} user login`);
  
      res.render("Shop.ejs", {
        Login: firstName,
        items_data: item_data,
      });
      console.log(`Successfully opened ${productType} ${req.user ? 'with' : 'without'} user logged in`);
    } catch (error) {
      console.log("Unable to retrieve stock", error);
    }
};
  
// Route for Wheels
app.get("/Wheels", authenticateUser, (req, res) => {
    renderItems(req, res, "Wheels", "stock_wheels");
});
  
  // Route for Helmets
app.get("/Helmets", authenticateUser, (req, res) => {
    renderItems(req, res, "Helmets", "stock_helmets");
});
  
  // Route for SkinSuits
app.get("/SkinSuits", authenticateUser, (req, res) => {
    renderItems(req, res, "SkinSuits", "stock_skinsuits");
});
  
  // Route for Accessories
app.get("/Accessories", authenticateUser, (req, res) => {
    renderItems(req, res, "Accessories", "stock_accessories");
});
  
  // Route for Skates
app.get("/Skates", (req, res) => {
    res.redirect("/Shop");
    console.log("Successfully redirected to shop");
});
  
// app.post("/AddToCart", authenticateUser, async (req, res) => {
//     if (!req.user || !req.user.Email) {
//         res.render("login.ejs");
//     }
  
//     try {
//         const userResult = await db.query(`SELECT * FROM users WHERE email=$1`, [
//             req.user.Email,
//         ]);
  
//         if (userResult.rows.length === 0) {
//             console.log("User not found:", req.user.Email);
//             res.render("login.ejs");
//         }
  
//         const user = userResult.rows[0];
//         const userId = user.user_id;
  
//         if (!userId) {
//             console.log("User ID is null");
//             return res.status(500).send("User ID is null");
//         }
  
//         const { item_id, item_type, quantity } = req.body;
//         console.log("Item details:", { item_id, item_type, quantity });
  
//         const itemResult = await db.query(
//             `SELECT * FROM stock_${item_type} WHERE item_id=$1`,
//             [item_id]
//         );
//         if (itemResult.rows.length === 0) {
//             console.log("Item not found:", { item_id, item_type });
//             return res.status(404).send("Item not found");
//         }
  
//         const item = itemResult.rows[0];
//         const availableItemQuantity = item.quantity;
  
//         const itemCheckInCart = await db.query(
//             "SELECT * FROM cart WHERE user_id=$1 AND item_id=$2",
//             [userId, item_id]
//         );
  
//         if (itemCheckInCart.rows.length === 0) {
//             const insertQuantity =
//                 quantity <= availableItemQuantity ? quantity : availableItemQuantity;
//             await db.query(
//                 "INSERT INTO cart (user_id, img, name, description, item_id, price, quantity) VALUES ($1, $2, $3, $4, $5, $6, $7)",
//                 [
//                     userId,
//                     item.img,
//                     item.name,
//                     item.description,
//                     item.item_id,
//                     item.price,
//                     insertQuantity,
//                 ]
//             );
//             console.log(
//                 "Item added to cart successfully with quantity:",
//                 insertQuantity
//             );
//         } else {
//             const existingQuantity = itemCheckInCart.rows[0].quantity;
//             const newQuantity = Math.min(
//                 existingQuantity + parseInt(quantity),
//                 availableItemQuantity
//             );
//             await db.query(
//                 "UPDATE cart SET quantity=$1 WHERE user_id=$2 AND item_id=$3",
//                 [newQuantity, userId, item_id]
//             );
//             console.log("Item quantity updated in cart to:", newQuantity);
//         }
  
//         res.status(200).json({ success: true, message: "Item added to cart successfully" });
//     } catch (error) {
//         console.error("Error in /AddToCart:", error);
//         res.status(500).json({ success: false, message: "Internal Server Error" });
//     }
// });

// app.post("/AddToCart", authenticateUser, async (req, res) => {
//   if (!req.user || !req.user.Email) {
//       return res.render("login.ejs"); // Stop further execution if not logged in
//   }

//   try {
//       const userResult = await db.query(`SELECT * FROM users WHERE email=$1`, [
//           req.user.Email,
//       ]);

//       if (userResult.rows.length === 0) {
//           console.log("User not found:", req.user.Email);
//           return res.render("login.ejs"); // Stop further execution if user not found
//       }

//       const user = userResult.rows[0];
//       const userId = user.user_id;

//       if (!userId) {
//           console.log("User ID is null");
//           return res.status(500).send("User ID is null");
//       }

//       const { item_id, item_type, quantity } = req.body;
//       console.log("Item details:", { item_id, item_type, quantity });

//       const itemResult = await db.query(
//           `SELECT * FROM stock_${item_type} WHERE item_id=$1`,
//           [item_id]
//       );

//       if (itemResult.rows.length === 0) {
//           console.log("Item not found:", { item_id, item_type });
//           return res.status(404).send("Item not found");
//       }

//       const item = itemResult.rows[0];
//       const availableItemQuantity = item.quantity;

//       const itemCheckInCart = await db.query(
//           "SELECT * FROM cart WHERE user_id=$1 AND item_id=$2",
//           [userId, item_id]
//       );

//       if (itemCheckInCart.rows.length === 0) {
//           const insertQuantity =
//               quantity <= availableItemQuantity ? quantity : availableItemQuantity;
//           await db.query(
//               "INSERT INTO cart (user_id, img, name, description, item_id, price, quantity) VALUES ($1, $2, $3, $4, $5, $6, $7)",
//               [
//                   userId,
//                   item.img,
//                   item.name,
//                   item.description,
//                   item.item_id,
//                   item.price,
//                   insertQuantity,
//               ]
//           );
//           console.log(
//               "Item added to cart successfully with quantity:",
//               insertQuantity
//           );
//       } else {
//           const existingQuantity = itemCheckInCart.rows[0].quantity;
//           const newQuantity = Math.min(
//               existingQuantity + parseInt(quantity),
//               availableItemQuantity
//           );
//           await db.query(
//               "UPDATE cart SET quantity=$1 WHERE user_id=$2 AND item_id=$3",
//               [newQuantity, userId, item_id]
//           );
//           console.log("Item quantity updated in cart to:", newQuantity);
//       }

//       res.status(200).json({ success: true, message: "Item added to cart successfully" });
//   } catch (error) {
//       console.error("Error in /AddToCart:", error);
//       res.status(500).json({ success: false, message: "Internal Server Error" });
//   }
// });
app.post("/AddToCart", authenticateUser, async (req, res) => {
  if (!req.user || !req.user.Email) {
      return res.status(401).json({ loginRequired: true }); // Send a 401 status for unauthenticated users
  }

  try {
      const userResult = await db.query(`SELECT * FROM users WHERE email=$1`, [
          req.user.Email,
      ]);

      if (userResult.rows.length === 0) {
          console.log("User not found:", req.user.Email);
          return res.status(401).json({ loginRequired: true }); // Send a 401 status if user not found
      }

      const user = userResult.rows[0];
      const userId = user.user_id;

      if (!userId) {
          console.log("User ID is null");
          return res.status(500).send("User ID is null");
      }

      const { item_id, item_type, quantity } = req.body;
      console.log("Item details:", { item_id, item_type, quantity });

      const itemResult = await db.query(
          `SELECT * FROM stock_${item_type} WHERE item_id=$1`,
          [item_id]
      );

      if (itemResult.rows.length === 0) {
          console.log("Item not found:", { item_id, item_type });
          return res.status(404).send("Item not found");
      }

      const item = itemResult.rows[0];
      const availableItemQuantity = item.quantity;

      const itemCheckInCart = await db.query(
          "SELECT * FROM cart WHERE user_id=$1 AND item_id=$2",
          [userId, item_id]
      );

      if (itemCheckInCart.rows.length === 0) {
          const insertQuantity =
              quantity <= availableItemQuantity ? quantity : availableItemQuantity;
          await db.query(
              "INSERT INTO cart (user_id, img, name, description, item_id, price, quantity) VALUES ($1, $2, $3, $4, $5, $6, $7)",
              [
                  userId,
                  item.img,
                  item.name,
                  item.description,
                  item.item_id,
                  item.price,
                  insertQuantity,
              ]
          );
          console.log(
              "Item added to cart successfully with quantity:",
              insertQuantity
          );
      } else {
          const existingQuantity = itemCheckInCart.rows[0].quantity;
          const newQuantity = Math.min(
              existingQuantity + parseInt(quantity),
              availableItemQuantity
          );
          await db.query(
              "UPDATE cart SET quantity=$1 WHERE user_id=$2 AND item_id=$3",
              [newQuantity, userId, item_id]
          );
          console.log("Item quantity updated in cart to:", newQuantity);
      }

      res.status(200).json({ success: true, message: "Item added to cart successfully" });
  } catch (error) {
      console.error("Error in /AddToCart:", error);
      res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

//yaha pe join us ka hai
app.get("/joinUs",authenticateUser,(req,res)=>{
  if(req.user){    
    res.render("joinUs.ejs");
  }else{
    res.redirect("/newlogin");
  }
});

//yaha pe join us ka end hai
app.get("/Cart", authenticateUser, async (req, res) => {
    try {
        // Initialize variables for rendering
        let firstName = null;
        let addedItemsOnCart = [];

        // Fetch user details from the database
        const userResult = await db.query(`SELECT * FROM users WHERE email=$1`, [
            req.user?.Email,
        ]);

        // Check if user exists and extract user details
        if (userResult.rows.length > 0) {
            const user = userResult.rows[0];
            const userId = user.user_id;

            if (userId) {
                firstName = req.user.fullName.split(" ")[0]; // Extract first name
                const { rows } = await db.query(
                    "SELECT * FROM cart WHERE user_id = $1",
                    [userId]
                );
                addedItemsOnCart = rows; // Set added items for logged-in user
            } else {
                console.log("User ID is null");
            }
        } else {
            console.log("User not found:", req.user?.Email);
        }

        // Render the cart page with appropriate values
        res.render("Cart.ejs", {
            Login: firstName,
            Addeditem: addedItemsOnCart,
        });
        console.log(req.user ? "Successfully opened Cart with user log in" : "Successfully opened Cart without user logged in");
    } catch (error) {
        console.error("Error opening Cart:", error);
        res.status(500).send("An error occurred, please try again.");
    }
});
// yaha pe item cart se remove karne ka hai.
app.post("/removeItemFromCart", authenticateUser, async (req, res) => {
    let userId;
    const firstName = req.user.fullName.split(" ")[0];
    if (!req.user) {
      res.render("login.ejs");
      return res.status(401).send("User not authenticated");
    }
  
    try {
      const Userdetails = await db.query("SELECT * FROM users WHERE email=$1", [
        req.user.Email,
      ]);
      if (Userdetails.rows.length > 0) {
        userId = Userdetails.rows[0].user_id;
        console.log("User ID:", userId);
      } else {
        userId = null;
        console.log("Cannot get user_id");
      }
    } catch (error) {
      console.log("Cannot search for user", error);
      return res.status(500).json({ success: false, error: "Database error" });
    }
  
    if (!userId) {
      res.status(404).json({ success: false, error: "User not found" });
      return;
    }
  
    try {
      const { item_id, item_type } = req.body;
      console.log("Item ID:", item_id);
      console.log("Item Type:", item_type);
  
      try {
        const removingItemFromCart = await db.query(
          "DELETE FROM cart WHERE user_id=$1 AND item_id=$2",
          [userId, item_id]
        );
      
        if (removingItemFromCart.rowCount === 0) {
          console.log("No rows affected, item not found in cart");
          res.status(404).json({ success: false, error: "Item not found in cart" });
        } else {
          console.log("Item successfully deleted from cart and database");
          res.status(200).json({ success: true, message: "Item removed from cart" });
        }
      } catch (error) {
        console.log("Error removing item from cart", error);
        res.status(500).json({ success: false, error: "Database error" });
      }
      
    } catch (error) {
      console.log("Error getting item details", error);
      res.status(500).json({ success: false, error: "Server error" });
    }
});

app.get("/Logout", (req, res) => {
    res.clearCookie("token");
    res.redirect("/");
});
app.get("/Profile", authenticateUser, async (req, res) => {
    if (req.user) {
      const firstName = req.user.fullName.split(" ")[0];
      try {
        const { rows: user_data } = await db.query(
          "SELECT * FROM users WHERE email=$1",
          [req.user.Email]
        );
        const { rows: user_data_address } = await db.query(
          "SELECT * FROM users_address WHERE email=$1",
          [req.user.Email]
        );
        if (user_data.length > 0) {
          res.render("profile.ejs", {
            Login: firstName,
            user_data: user_data[0],
            user_data_address: user_data_address[0],
          });
        }
      } catch (error) {
        console.log("User does not exist", error);
      }
  
      console.log("Successfully opened profile with user log in");
    } else {
      res.render("login.ejs");
      console.log("Successfully opened login as user is not logged in");
    }
});
  
app.get("/Password_change", authenticateUser, (req, res) => {
      try {
          if (req.user) {
        res.render("changePassword.ejs");
        console.log("changePassword page sucessfully rendered");
      } else {
        res.render("login.ejs");
        console.log("User not logged in and trying to change password");
      }
    } catch (error) {}
});
  
app.post("/Change_password", authenticateUser, async (req, res) => {
    try {
      if (req.user) {
        const { current_password, new_password, confirm_password } = req.body;
  
        const email = req.user.Email;
        const searchingUser = await db.query(
          "SELECT * FROM users WHERE email=$1",
          [email]
        );
        const user_found = searchingUser.rows[0];
        if (searchingUser.rows.length > 0) {
          console.log("User found in the database for changing password");
          const PassCheck = await bcrypt.compare(
            current_password,
            user_found.password_entered
          );
          if (PassCheck) {
            console.log(
              "existing password is same as password stored in the database"
            );
            if (new_password === confirm_password) {
              const saltRounds = 10;
              const salt = await bcrypt.genSalt(saltRounds);
              const hashedPassword = await bcrypt.hash(confirm_password, salt);
              console.log("new password matches confirm password block");
              await db.query(
                "UPDATE users SET password_entered=$1 WHERE email=$2",
                [hashedPassword,email]
              );
              res.render("login.ejs");
  
              res.render("changePassword.ejs", {
                error: "New passwords do not match.",
              });
            }
          } else {
            res.render("changePassword.ejs", {
              error: "Current password is incorrect.",
            });
          }
        } else {
          res.render("changePassword.ejs", { error: "User not found." });
        }
      } else {
        res.render("login.ejs");
      }
    } catch (error) {
      console.error("Error processing password change:", error);
      res.status(500).send("Internal Server Error");
    }
});
  
//Header part endpoints ends here
// For Mobile Number
app.post("/EnterMobileNumber", authenticateUser, async (req, res) => {
    const { mobile_number } = req.body;
    if (req.user) {
      try {
        const addMobileNumber = await db.query(
          "SELECT * FROM users WHERE email=$1",
          [req.user.Email]
        );
        if (addMobileNumber.rows.length > 0) {
          await db.query("UPDATE users SET mobile_number=$1 WHERE email=$2", [
            mobile_number,
            req.user.Email,
          ]);
          console.log("Mobile number successfully updated in the database");
          res.redirect("/Profile");
        }
      } catch (error) {
        console.log("Error updating mobile number:", error);
        res.status(500).send("Internal server error");
      }
    }
});
  
  // For Address
app.post("/EnterAddress", authenticateUser, async (req, res) => {
    const { address } = req.body;
    if (req.user) {
      try {
        const addAddress = await db.query(
          "SELECT * FROM users_address WHERE email=$1",
          [req.user.Email]
        );
        if (addAddress.rows.length > 0) {
          await db.query("UPDATE users_address SET address=$1 WHERE email=$2", [
            address,
            req.user.Email,
          ]);
          console.log("Address successfully updated in the database");
          res.redirect("/Profile");
        }
      } catch (error) {
        console.log("Error updating address:", error);
        res.status(500).send("Internal server error");
      }
    }
});
  
  // For City
app.post("/EnterCity", authenticateUser, async (req, res) => {
    const { city } = req.body;
    if (req.user) {
      try {
        const addAddress = await db.query(
          "SELECT * FROM users_address WHERE email=$1",
          [req.user.Email]
        );
        if (addAddress.rows.length > 0) {
          await db.query("UPDATE users_address SET city=$1 WHERE email=$2", [
            city,
            req.user.Email,
          ]);
          console.log("City successfully updated in the database");
          res.redirect("/Profile");
        }
      } catch (error) {
        console.log("Error updating city:", error);
        res.status(500).send("Internal server error");
      }
    }
});
  
  // For State
app.post("/EnterState", authenticateUser, async (req, res) => {
    const { state } = req.body;
    if (req.user) {
      try {
        const addAddress = await db.query(
          "SELECT * FROM users_address WHERE email=$1",
          [req.user.Email]
        );
        if (addAddress.rows.length > 0) {
          await db.query("UPDATE users_address SET state=$1 WHERE email=$2", [
            state,
            req.user.Email,
          ]);
          console.log("State successfully updated in the database");
          res.redirect("/Profile");
        }
      } catch (error) {
        console.log("Error updating state:", error);
        res.status(500).send("Internal server error");
      }
    }
});
  
  // For Zip Code
app.post("/EnterZip", authenticateUser, async (req, res) => {
    const { zip_code } = req.body;
  
    if (req.user) {
      // Validate the zip code using Postalpincode.in API
      const isValid = await validateIndianZipCode(zip_code);
      if (!isValid) {
        console.log("Invalid zip code");
        return res.status(400).send("Invalid zip code");
      }
  
      try {
        const addAddress = await db.query(
          "SELECT * FROM users_address WHERE email=$1",
          [req.user.Email]
        );
        if (addAddress.rows.length > 0) {
          await db.query("UPDATE users_address SET zip_code=$1 WHERE email=$2", [
            zip_code,
            req.user.Email,
          ]);
          console.log("Zip code successfully updated in the database");
          res.redirect("/Profile");
        } else {
          console.log("User not found in user_address database");
          res.status(404).send("User not registered");
        }
      } catch (error) {
        console.log("Error updating zip code:", error);
        res.status(500).send("Internal server error");
      }
    }
});
// yaha pe previous orders page ke liye hai.
//below two end points not working
app.get("/Orders",authenticateUser,(req,res)=>{
    if(req.user){
      const userEmail=req.user.Email;
    admin.userPreviousOrders(req,res,userEmail);
    }
});
app.get("/orderDetailsUser", authenticateUser, async (req, res) => {
    if (req.user) {
      const orderId = req.query.order_id;
      const userEmail = req.user.Email;
  
      // Fetch order details
      const orderData = await db.query("SELECT * FROM orders WHERE order_id=$1 AND email=$2", [orderId, userEmail]);
      const orderItems = orderData.rows;
      
      // Fetch details for each item in the order
      const itemDetails = [];
      for (const item of orderItems) {
        const details = await db.query(`SELECT * FROM stock_${item.item_type} WHERE item_id=$1`, [item.item_id]);
        itemDetails.push(details.rows[0]);
      }
  
      res.render("orderDetailsUser.ejs", {
        order: orderItems,
        itemDetails: itemDetails
      });
    }
});

//yaha pe academy achievements ka hai
app.get("/achievements", async (req, res) => {
    try {
      // Query the database to get the achievements
      const { rows: achievementData } = await db.query("SELECT * FROM achievements ORDER BY id ASC");
  
      // Check if there are achievements
      if (achievementData.length > 0) {
        // Render the page with achievements data
        res.render("achievements.ejs", {
          toastForNewsLetter: false, // Assuming no toast needed for this route
          achievementData: achievementData, // Pass the achievements data to the view
        });
        console.log("Achievements data successfully retrieved from database");
      } else {
        // Handle the case where there are no achievements
        res.render("achievements.ejs", {
          toastForNewsLetter: false,
          achievementData: [], // Empty array if no achievements
        });
        console.log("No achievements found.");
      }
    } catch (error) {
      console.error("Cannot retrieve achievements data from the database:", error.message);
  
      // Render an empty or error page in case of database error
      res.render("achievements.ejs", {
        toastForNewsLetter: false,
        achievementData: [], // Send an empty array in case of error
      });
    }
});
//yaha pe academy students details ka hai
app.get("/StudentsAchievements", authenticateUser, async (req, res) => {
  try {
    if (req.user) {
      try {
          const data = await db.query("SELECT * FROM students");
          const result = data.rows;
          res.render("studentsAchievements.ejs", {
              studentsAchievementsData: result
          });
      } catch (error) {
          console.error("Error fetching achievements:", error);
          res.status(500).send("Internal Server Error");
      }
  } else {
    res.render("studentsAchievements.ejs", {
      studentsAchievementsData:null
  });      
}
  } catch (error) {
    console.log("Error rendering students achievements page");
  }
    
});

app.post("/studentAchievementDetails", authenticateUser, async (req, res) => {
  if (req.user) {
      const studentId = req.body.studentId; 
      try {
          const data = await db.query(
              `SELECT * FROM students_achievements s1 
               JOIN students s2 ON s1.stud_id = s2.stud_id 
               WHERE s2.stud_id = $1`,
              [studentId]
          );
          const studentAchievements = data.rows; 
          res.render("offlineStudentsDetails.ejs", {
              studentDetails: studentAchievements
          });
      } catch (error) {
          console.error("Database query error:", error);
          res.status(500).send("Internal Server Error");
      }
  } else {
      res.status(401).send("Unauthorized");
  }
});
//yaha pe academy students details ka end hai

//yaha pe footer ka hai
app.use("/FAQ", authenticateUser,async (req, res) => {
  if(req.user){
    try {
      const firstName = req.user.fullName.split(" ")[0];
      const { rows: FAQ_data } = await db.query("SELECT * FROM faq");
      res.render("FAQ.ejs", { FAQ_data: FAQ_data, Login:firstName});
    } catch (error) {
      console.log("Unable to fetch FAQ's data");
    }
  }else{
    const { rows: FAQ_data } = await db.query("SELECT * FROM faq");
    res.render("FAQ.ejs", { FAQ_data: FAQ_data, Login:null});
  }
});

//Admin panel funtionnality starts here
//yaha pe newsletter ka hai
app.post("/subscribedToNewsLetter", authenticateUser, async (req, res) => {
    if (req.user) {
      try {
        const {Email} = req.body;
        console.log(Email);
        if (Email) {
          const checkDuplicateEmail_forNewsLetter = await db.query(
            "SELECT * FROM news_letter_subscriber WHERE email=$1",
            [Email]
          );
          if (checkDuplicateEmail_forNewsLetter.rows.length>0) {
            // res.render("/");
            res.send("Email already exist");
            console.log("Email already exist");
          } else {
            await db.query(
              "INSERT INTO news_letter_subscriber(email) VALUES($1)",
              [Email]
            );
            res.redirect("/");
            console.log("Email successfully added for news letter");
           }
        }
      } catch (error) {
        res.redirect("/");
        console.log("Failed to get email subscribe news letter route", error);
      }
    } else {
      res.redirect("/newLogin");
      console.log(
        "User not logged in and trying to subscribe to newsLetter that is why redirected to login page"
      );
    }
});
// Route for sending newsletters
app.get("/Create_newsLetter", authenticateUser, async (req,res) => {
    admin.createNewsLetterAdmin(req,res);
    });
// yaha pe news letter bhejne ka hai for admin.
app.get("/adminDashboard",authenticateUser,(req,res)=>{
    const firstName = req.user.fullName.split(" ")[0];
    admin.adminRole(req,res,firstName);
  });
app.get("/updateAchievements",authenticateUser,(req,res)=>{
    if(req.user){
      res.render("Update_Achievements.ejs");
      console.log("Update achievements page opened");
    }else{
      res.redirect("/newLogin");
      console.log("Update achievements page not opened user not logged in");
    }
  });   
  
app.post("/NewsLetter_Sending", async (req, res) => {
  const { Title, Description } = req.body;

  // Set up the email transporter
  const transporter = nodemailer.createTransport({
      service: 'gmail', // You can use other services like Outlook, SMTP, etc.
      auth: {
          user: process.env.nodeMailerEmailValidatorEmail, // Your email
          pass: process.env.nodeMailerEmailValidatorPass// Your email password or app password
      }
  });

  // Function to send email to each subscriber
  const sendNewsletter = async (email) => {
      const mailOptions = {
          from: process.env.nodeMailerEmailValidatorEmail,
          to: email,
          subject: Title,
          text: Description
      };

      return transporter.sendMail(mailOptions);
  };

  try {
      // Retrieve all newsletter subscribers from the database
      const result = await db.query("SELECT * FROM news_letter_subscriber");
      const subscribers = result.rows;

      // Send the email to each subscriber and wait for all to finish
      for (const subscriber of subscribers) {
          await sendNewsletter(subscriber.email); // Send email and await each response
          console.log(`Email sent to: ${subscriber.email}`);
      }

      // Redirect to dashboard with success parameter
      res.redirect('/adminDashboard?newsletterStatus=success');
  } catch (error) {
      console.error("Failed to send newsletter:", error);
      res.redirect('/adminDashboard?newsletterStatus=failure'); // Redirect with failure parameter
  }
});

// yaha pe images user se lena ka hai middleware.
const storage = multer.diskStorage({
    destination: path.join(_dirname, 'public/images'), // Store files in public/images
    filename: function (req, file, cb) {
      const timestamp = Date.now();
      const fileExt = path.extname(file.originalname);
      const filename = `${timestamp}-${file.originalname}`;
      cb(null, filename);
    }
  });
  
  const upload = multer({ storage: storage });
  // Define your route with multer middleware
  app.post('/AddAchievements', authenticateUser, upload.single('imageTaken'), async (req, res) => {
    const { placeName, medalsWon, description } = req.body;
    const imageTaken = req.file;
  
    // Check if user is authenticated
    if (!req.user) {
      console.error('Unauthorized access: req.user is undefined');
      return res.status(401).send('Unauthorized');
    }
  
    try {
      const imagePath = `/images/${imageTaken.filename}`;
  
      // Insert the achievement into the database
      const result = await db.query(
        "INSERT INTO achievements(img, name, medals_won, description) VALUES($1, $2, $3, $4) RETURNING *",
        [imagePath, placeName, medalsWon, description]
      );
  
      // Check if the insertion was successful
      if (result.rowCount > 0) {
        console.log('Achievement successfully added to the database.');
  
        // Retrieve all achievements from the database after adding the new one
        const { rows: achievementData } = await db.query("SELECT * FROM achievements ORDER BY id DESC");
  
        if (achievementData.length > 0) {
          console.log('Rendering achievements.ejs with data:', achievementData);
          // Render the achievements page with the retrieved data
          res.render("achievements.ejs", {
            toastForNewsLetter:false,
            achievementData: achievementData,
          });
        } else {
          console.log('No achievements data found.');
          // Render the page with an empty achievements array if none found
          res.render('achievements.ejs', {
            achievementData: [],
            toastForNewsLetter: true,
          });
        }
      } else {
        console.error('Failed to add the achievement.');
        res.status(500).send('Failed to add achievements.');
      }
    } catch (error) {
      console.error('Error inserting or retrieving achievements from the database:', error.message);
      res.status(500).send('Failed to retrieve or add achievements.');
    }
  });
  
  app.get("/downloadOnlineUserData",async(req,res)=>{
    const data = await db.query("SELECT * FROM users");
    const users = data.rows;
      console.log(users);
    admin.downloadOnlineUsersList(req,res,users);
  });
  app.get("/downloadofflineUserData",async(req,res)=>{
    const data = await db.query("SELECT * FROM offline_customer");
    const users = data.rows;
      console.log(users);
    admin.downloadOfflineUsersList(req,res,users);
  });
  app.get("/downloadavailableStock",async(req,res)=>{
    const dataSkate = await db.query("SELECT * FROM stock_skates");
    const dataHelmets = await db.query("SELECT * FROM stock_helmets");
    const dataWheels = await db.query("SELECT * FROM stock_wheels");
    const dataSkinSuits = await db.query("SELECT * FROM stock_skinsuits");
    const dataAccessories = await db.query("SELECT * FROM stock_accessories");
    const availableStockSkate= dataSkate.rows;
    const availableStockHelmets= dataHelmets.rows;
    const availableStockWheels= dataWheels.rows;
    const availableStockSkinSuits= dataSkinSuits.rows;
    const availableStockAccessories= dataAccessories.rows;
    const totalStock = availableStockSkate.concat(availableStockHelmets, availableStockWheels, availableStockSkinSuits, availableStockAccessories);
    // console.log(totalStock);
    admin.downloadavailableStock(req,res,totalStock);
  });
  app.get("/downloadOnlineSaleList", async (req, res) => {
    try {
      const data = await db.query("SELECT * FROM orders WHERE status=$1 ORDER BY created_at DESC", ['Delivered']);
      const ordersOnline = data.rows;
      console.log(ordersOnline);
      admin.downloadOnlineSaleList(req, res, ordersOnline);
    } catch (error) {
      console.error("Error fetching online sale list:", error);
      res.status(500).send("Error fetching online sale list");
    }
  });
  app.get("/registerNewStudent",authenticateUser,async (req,res)=>{
  if(req.user){
    res.render("NewStudentRegistration.ejs",{
      toastMessage:false,
    });
  }
  });
  app.post("/addStudent", authenticateUser, async (req, res) => {
    const { Student_Name, Father_name, Mother_name, mobile_number, email, groupAddedOn, skate_type, feePaid,feeStructure } = req.body;
    try {
      try {
        if (Student_Name && Father_name && Mother_name && mobile_number && email && groupAddedOn && skate_type && feePaid && feeStructure) {
            // Check if the student already exists
            const result = await db.query("SELECT * FROM students WHERE student_name=$1 AND father_name=$2 AND mother_name=$3", [Student_Name, Father_name, Mother_name]);
  
            if (result.rows.length > 0) {
                console.log("Student already exists in the database");
                res.render("NewStudentRegistration.ejs", { toastMessage: true });
                // return 'e'; // Student exists
            } else {
                // Insert new student
                const response = await db.query(
                    "INSERT INTO students (student_name, father_name, mother_name, mobile_number, email, groupAddedOn, skate_type, feePaid,feeStructure) VALUES ($1, $2, $3, $4, $5, $6, $7, $8,$9)",
                    [Student_Name, Father_name, Mother_name, mobile_number, email, groupAddedOn, skate_type, feePaid,feeStructure]
                );
  
                //date is set to default current date and will be set automatically so no need to pass it.
  
                if (response.rowCount > 0) {
                    console.log("Student registered and details added to the database");
                    res.render("NewStudentRegistration.ejs", { toastMessage: true });
                } else {
                    console.log("Student not registered and details not added to the database");
                    res.render("NewStudentRegistration.ejs", { toastMessage: false });
                }
            }
        } else {
            console.log("Incomplete student data");
            res.render("NewStudentRegistration.ejs", { toastMessage: false });
        }
    } catch (error) {
        console.log("Error adding student:", error);
        res.render("NewStudentRegistration.ejs", { toastMessage: false });
    }
    } catch (error) {
        console.error("Error adding student:", error);
        res.render("NewStudentRegistration.ejs", { toastMessage: false });
    }
  });
  // Attendance part starts from Here.
  app.get("/markingAttendance",authenticateUser,async(req,res)=>{
    if(req.user){
    const stud_data=await db.query("Select * from students");
    // console.log(stud_data);
    res.render("Attendance_Page.ejs",{
      stud_data:stud_data.rows,//sending the data of students to the client side from here
      toast:false,
    });
    }else{
      res.render("login.ejs");
    }
  })
  app.post('/confirmAttendance', async (req, res) => {
    const attendanceData = req.body; // This should contain attendance_<student_id>
    console.log('Received Attendance Data:', attendanceData); // Check the structure
  
    try {
        for (const key in attendanceData) {
            // Extract the student ID from the key
            const studentId = key.split('_')[1]; // Get the ID from the key
  
            // Check if studentId is valid before proceeding
            if (!studentId || isNaN(studentId)) {
                console.error(`Invalid student ID: ${studentId}`);
                continue; // Skip this iteration if student ID is invalid
            }
  
            const attendanceStatus = attendanceData[key]; // Get the corresponding status
            
            // Check if attendance for the student already exists for today
            const existingRecord = await db.query(
                `SELECT * FROM attendance WHERE student_id = $1 AND attendance_date::date = $2`,
                [studentId, new Date()]
            );
  
            // If a record exists, skip the insertion for this student
            if (existingRecord.rows.length > 0) {
                console.log(`Attendance already recorded for student ${studentId} on this date.`);
                continue; // Skip inserting if attendance already exists
            }
  
            // Insert the new attendance record
            await db.query(
                `INSERT INTO attendance (student_id, status, attendance_date) VALUES ($1, $2, $3)`,
                [studentId, attendanceStatus, new Date()]
            );
        }
  
        res.redirect("/adminDashboard");
    } catch (error) {
        console.error('Error inserting attendance data:', error);
        res.redirect("/markingAttendance");
    }
  });
  app.get("/monthlyAttendance",authenticateUser,async(req,res)=>{
    try {
      if(req.user){
        const data=await db.query("Select stud_id,student_name,mother_name from students");
        const attendance_data=data.rows;
        res.render("monthlyAttendance.ejs",{
          attendance_data:attendance_data,
        });
      }
    } catch (error) {
      res.render("login.ejs");
    }
  })
  app.post("/studentAttendanceDetails", authenticateUser, async (req, res) => {
    try {
      if (req.user) {
        const { student_id_entered, SelectedMonth } = req.body;
  
        // Corrected query with filtering by student_id_entered
        const studentData = await db.query(`
          SELECT s.stud_id, s.student_name, s.mother_name, a.attendance_date, a.status 
          FROM attendance a 
          JOIN students s ON s.stud_id = a.student_id 
          WHERE s.stud_id = $1 AND EXTRACT(MONTH FROM a.attendance_date) = $2
        `, [student_id_entered, SelectedMonth]);
  
        await admin.attendanceDetails(req, res, studentData.rows);
      } else {
        res.render("login.js");
      }
    } catch (error) {
      console.error("Error processing attendance details:", error);
      res.status(500).send('Internal Server Error');
    }
  });
  // Attendance part ends from Here.
  app.get("/downloadOfflineSaleList", async (req, res) => {
    try {
      const data = await db.query("SELECT * FROM orders_offline ORDER BY created_at DESC");
      const ordersOffline = data.rows;
      console.log(ordersOffline);
      admin.downloadOfflineSaleList(req, res, ordersOffline);
    } catch (error) {
      console.error("Error fetching online sale list:", error);
      res.status(500).send("Error fetching online sale list");
    }
  });
  app.get("/editHomePage",authenticateUser,(req,res)=>{
    if(req.user){
      res.render("edit_Home.ejs");
    }
  });
  // yaha pe shop ke edit karne ka hai.
  app.get("/editShop",authenticateUser,async(req,res)=>{
    try {
    const firstName = req.user.fullName.split(" ")[0];
      const dataSkate = await db.query("SELECT * FROM stock_skates");
      const dataHelmets = await db.query("SELECT * FROM stock_helmets");
      const dataWheels = await db.query("SELECT * FROM stock_wheels");
      const dataSkinSuits = await db.query("SELECT * FROM stock_skinsuits");
      const dataAccessories = await db.query("SELECT * FROM stock_accessories");
      const availableStockSkate= dataSkate.rows;
      const availableStockHelmets= dataHelmets.rows;
      const availableStockWheels= dataWheels.rows;
      const availableStockSkinSuits= dataSkinSuits.rows;
      const availableStockAccessories= dataAccessories.rows;
      const totalStock = availableStockSkate.concat(availableStockHelmets, availableStockWheels, availableStockSkinSuits, availableStockAccessories);
      res.render("editShop.ejs",{
        items_data:totalStock,
        Login:firstName,
        toastForNewsLetter:false,
      })
    } catch (error) { 
      console.log("Cannot get items data for Edit shop page");
    }
  });
  app.get("/updateItemForShop", authenticateUser, async (req, res) => {
    try {
        const { item_id, item_type } = req.query; // Assuming item_id and item_type are passed as query parameters
        // console.log(item_id,item_type);
        const data = await db.query(`SELECT * FROM stock_${item_type} WHERE item_id=$1`, [item_id]);
        const result = data.rows[0];
        if (!result) {
            return res.status(404).send("Item not found");
        }
        res.render("updateItem.ejs", { item_data: result });
    } catch (error) {
        console.error("Error fetching item for update:", error);
        res.status(500).send("An error occurred while fetching the item.");
    }
  });
  app.post("/deleteItemFromShop", authenticateUser, async (req, res) => {
    try {
      if (req.user) {
        const { item_id, item_type } = req.body;
  
        // Corrected SQL query typo from FORM to FROM
        const data = await db.query(`SELECT * FROM stock_${item_type} WHERE item_id=$1`, [item_id]);
        const result = data.rows[0];
  
        if (result) {
          await db.query(`DELETE FROM stock_${item_type} WHERE item_id=$1`, [item_id]);
          console.log("Item deleted successfully");
          
          await db.query(`DELETE FROM product_details WHERE item_id=$1`, [item_id]);
          res.redirect("/editShop");
        } else {
          console.log("Item does not exist for deletion");
          res.status(404).send("Item not found");
        }
      } else {
        res.status(403).send("Unauthorized access");
      }
    } catch (error) {
      console.error("Error deleting item:", error);
      res.status(500).send("Internal server error");
    }
  });
  
  app.post("/updateItemForShop", authenticateUser, async (req, res) => {
    try {
      if (req.user) {
        const { item_id, item_type } = req.body;
  
        const data = await db.query(`SELECT * FROM stock_${item_type} WHERE item_id=$1`, [item_id]);
        const result = data.rows[0];
  
        if (!result) {
          return res.status(404).json({ success: false, message: "Item not found" });
        }
  
        res.json({ success: true, item_data: result });
      } else {
        res.status(401).json({ success: false, message: "Unauthorized" });
      }
    } catch (error) {
      console.error("Error occurred:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });
  app.get("/addNewItem",authenticateUser,(req,res)=>{
  if(req.user){
    res.render("add_itemPage.ejs");
    console.log("Add item page rendered successfully");
  }else{
    res.redirect("/newLogin");
    console.log("Add item page cannot be rendered admin not logged in");
  }
  });
  // app.post("/completeAddingNewItem", authenticateUser, async (req, res) => {
  //   try {
  //     // Use multer to upload the first image
  //     const itemsImage = await new Promise((resolve, reject) => {
  //       upload.single('itemsImage')(req, res, (err) => {
  //         if (err) reject(err);
  //         resolve(req.file);
  //       });
  //     });
  
  //     // Use multer to upload the second image
  //     const itemsImage1 = await new Promise((resolve, reject) => {
  //       upload.single('itemsImage1')(req, res, (err) => {
  //         if (err) reject(err);
  //         resolve(req.file);
  //       });
  //     });
  
  //     // Use multer to upload the third image
  //     const itemsImage2 = await new Promise((resolve, reject) => {
  //       upload.single('itemsImage2')(req, res, (err) => {
  //         if (err) reject(err);
  //         resolve(req.file);
  //       });
  //     });
  
  //     // Extract data from request body
  //     const { itemsName, itemsDescription, itemsItemId, itemsPrice, itemsQuantity, itemsItemType } = req.body;
  
  //     // Check if all images are uploaded
  //     if (!itemsImage) {
  //       console.error('Error: itemsImage is missing');
  //       return res.status(400).send('Missing itemsImage');
  //     }
  //     if (!itemsImage1) {
  //       console.error('Error: itemsImage1 is missing');
  //       return res.status(400).send('Missing itemsImage1');
  //     }
  //     if (!itemsImage2) {
  //       console.error('Error: itemsImage2 is missing');
  //       return res.status(400).send('Missing itemsImage2');
  //     }
  
  //     // Build image paths
  //     const imagePath = `/images/${itemsImage.filename}`;
  //     const imagePath1 = `/images/${itemsImage1.filename}`;
  //     const imagePath2 = `/images/${itemsImage2.filename}`;
  
  //     // Check if the item ID already exists in the corresponding stock table
  //     const data = await db.query(`SELECT * FROM stock_${itemsItemType} WHERE item_id = $1`, [itemsItemId]);
  //     const result = data.rows[0];
  
  //     if (result) {
  //       console.error("Item ID already in use. Please use another ID.");
  //       return res.status(400).send("Item ID already in use. Please use another ID.");
  //     }
  
  //     // Insert the new item into the corresponding stock table
  //     await db.query(
  //       `INSERT INTO stock_${itemsItemType} (img, name, description, item_id, price, quantity, item_type) 
  //        VALUES ($1, $2, $3, $4, $5, $6, $7)`,
  //       [imagePath, itemsName, itemsDescription, itemsItemId, itemsPrice, itemsQuantity, itemsItemType]
  //     );
  //     console.log("Item successfully added to stock table.");
  
  //     // Insert the additional images into the product_details table
  //     await db.query(
  //       `INSERT INTO product_details (img, img1, img2, item_id) 
  //        VALUES ($1, $2, $3, $4)`,
  //       [imagePath, imagePath1, imagePath2, itemsItemId]
  //     );
  //     console.log("Item successfully added to product details table.");
  
  //     // If everything is successful, redirect to /editShop
  //     res.redirect("/editShop");
      
  //   } catch (error) {
  //     console.error("Cannot retrieve item details:", error);
  //     return res.status(500).send('Server error');
  //   }
  // });
  
  // app.post("/completeAddingNewItem",authenticateUser,upload.single('itemsImage'),upload.single('itemsImage1'),upload.single('itemsImage2'),(req,res)=>{
  //   try {
  //     const {itemsName,itemsDescription,itemsItemId,itemsPrice,itemsQuantity,itemsItemType}=req.body;
  //     const imageTaken = req.file;
  //     const imageTaken1 = req.file;
  //     const imageTaken2 = req.file;
  //     const imagePath = `/images/${imageTaken.filename}`;
  //     const imagePath1 = `/images/${imageTaken1.filename}`;
  //     const imagePath2 = `/images/${imageTaken2.filename}`;
  //     const itemAddedSuccessfully=admin.addingNewItemInShop(imagePath,imagePath1,imagePath2,itemsName,itemsDescription,itemsItemId,itemsPrice,itemsQuantity,itemsItemType)
  //     if(itemAddedSuccessfully){
  //       res.redirect("/editShop");  
  //     }
  //   } catch (error) {
  //     console.log("Cannot retrieve item details",error);
  //   }
  // });
  
  app.post("/completeUpdationOfItem", authenticateUser, async (req, res) => {
    try {
      const { item_id, item_type, Change_itemName, ChangeItemDescription, addQuantity, ChangeItemPrice } = req.body;
  
      if (req.user) {
        console.log("Form data received:", req.body); // Logging the form data
        const firstName = req.user.fullName.split(" ")[0];
        try {
          const data = await db.query(`SELECT * FROM stock_${item_type} WHERE item_id=$1`, [item_id]);
          const currentItem = data.rows[0];
  
          if (!currentItem) {
            throw new Error("Item not found");
          }
  
          const newName = Change_itemName && Change_itemName !== currentItem.name ? Change_itemName : currentItem.name;
          const newDescription = ChangeItemDescription && ChangeItemDescription !== currentItem.description ? ChangeItemDescription : currentItem.description;
          const newPrice = ChangeItemPrice && ChangeItemPrice !== currentItem.price ? ChangeItemPrice : currentItem.price;
          const newAddedQuantity = addQuantity ? currentItem.quantity + parseInt(addQuantity, 10) : currentItem.quantity;
  
          await db.query(`UPDATE stock_${item_type} SET name=$1, description=$2, quantity=$3, price=$4 WHERE item_id=$5`, [
            newName,
            newDescription,
            newAddedQuantity,
            newPrice,
            item_id,
          ]);
  
          console.log("Update successful"); // Logging success
  
          const dataSkate = await db.query("SELECT * FROM stock_skates");
          const dataHelmets = await db.query("SELECT * FROM stock_helmets");
          const dataWheels = await db.query("SELECT * FROM stock_wheels");
          const dataSkinSuits = await db.query("SELECT * FROM stock_skinsuits");
          const dataAccessories = await db.query("SELECT * FROM stock_accessories");
  
          const availableStockSkate = dataSkate.rows;
          const availableStockHelmets = dataHelmets.rows;
          const availableStockWheels = dataWheels.rows;
          const availableStockSkinSuits = dataSkinSuits.rows;
          const availableStockAccessories = dataAccessories.rows;
  
          const totalStock = availableStockSkate.concat(
            availableStockHelmets,
            availableStockWheels,
            availableStockSkinSuits,
            availableStockAccessories
          );
  
          res.render("editShop.ejs", {
            Login:firstName,
            items_data: totalStock,
            toastForNewsLetter: true,
          });
        } catch (error) {
          console.error("Error in completeItemUpdation:", error);
          res.status(500).send("An error occurred while updating the item.");
        }
      } else {
        res.redirect("/newLogin");
      }
    } catch (error) {
      console.error("Error updating item:", error);
      res.status(500).send("An error occurred while updating the item.");
    }
  });
  
  app.get("/ordersStatus",authenticateUser,async(req,res)=>{
    const data =await db.query("SELECT * FROM orders");
    const result=data.rows;
    if(req.user){
      res.render("orders_status.ejs",{
        Order_data:result,
      });
    }else{
      res.render("login.ejs");
    }
  });
  
  app.post("/orderDetails",authenticateUser,async(req,res)=>{
    const {getOrderDetails}=req.body;
    if(req.user){
      const data=await db.query("SELECT * FROM orders WHERE order_id=$1",[getOrderDetails]);
      const result=data.rows[0];
      if(result){
      res.render("orderDetails.ejs",{
        order_data:result,
        toastForNewsLetter: false,
      });
    }else{
      res.render("orderDetails.ejs",{
        order_data:null,
        toastForNewsLetter: false,
      });
    }
    }
  });
  app.post("/changeStatus",authenticateUser,(req,res)=>{
    const newStatus=req.body.orderStatusChange;
    const orderId = req.body.orderId;
    if(req.user){
    admin.changeOrderStatus(req,res,newStatus,orderId);
    console.log("User is verified hence calling change status function");
    }else{
      res.render("login.ejs");
    }
  });
  app.post("/downloadOrderDetails",authenticateUser,async(req,res)=>{
    try {
      if(req.user){
        const orderId = req.body.orderId;
        const data=await db.query("SELECT * FROM orders WHERE order_id=$1",[orderId])
        const order_data=data.rows[0];
        if(order_data){
      admin.getOrderDetails(req,res,order_data);
        }
    else{
  console.log("Could not get order it does not exist ");
    }
      }else{
        res.render("login.js");
      }
    } catch (error) {
      console.log("could not download oreder details",error);
    }
  });
  app.post("/editAchievementsText", authenticateUser, async (req, res) => {
    try {
      const userDetails = await db.query("SELECT * FROM users WHERE email = $1", [req.user.Email]);
      const userCheck = userDetails.rows[0];
      const firstName = userCheck.full_name.split(" ")[0];
      const { editTextForAchievements } = req.body;
  
      if (req.user) {
        await admin.editAchievementsText(req, res, editTextForAchievements, firstName);
      } else {
        res.redirect("/login"); // Redirect to login if user is not authenticated
      }
    } catch (error) {
      console.log("Error fetching user details", error);
      res.status(500).send("Internal Server Error");
    }
  });
  app.post("/editMeetOurCoachText", authenticateUser, async (req, res) => {
    try {
      const userDetails = await db.query("SELECT * FROM users WHERE email = $1", [req.user.Email]);
      const userCheck = userDetails.rows[0];
      const firstName = userCheck.full_name.split(" ")[0];
      const { editTextForMeetOurCoach } = req.body;
  
      if (req.user) {
        await admin.editMeetOurCoachText(req, res, editTextForMeetOurCoach, firstName);
      } else {
        res.redirect("/login"); // Redirect to login if user is not authenticated
      }
    } catch (error) {
      console.log("Error fetching user details", error);
      res.status(500).send("Internal Server Error");
    }
  });
  
  // yaha pe invoice ka hai.
  app.get("/createInvoice",authenticateUser,async(req,res)=>{
    try {
      const itemsData=["skates","helmets","wheels","skinsuits","accessories"];
      const allItemsData={};
      if(req.user){
      for(var i=0 ; i<itemsData.length ; i++){
        const result = await db.query(`SELECT * FROM stock_${itemsData[i]} WHERE quantity >= 1`);
  allItemsData[itemsData[i]] = result.rows;//yaha pe key value pair ban raha hai where items name is the key and result.rows is values to those key
      }
      res.render("generate_invoice.ejs", {
        item_data: allItemsData
      });
        console.log("generate invoice page opened sucessfully");
      }
    } catch (error) {
      res.render("login.ejs");
      console.log("cannot open invoice page",error);
    }
  });
  app.post("/generateInvoice",authenticateUser,async(req,res)=>{
    try {
      const {customer_name,customer_email,customer_number}=req.body;
      const {items}=req.body;//here items is like the array of objects
      // console.log(items);   
      if(req.user){
        const offlineCustomerCheck=await db.query("SELECT * FROM offline_customer WHERE email=$1 AND mobile_number=$2",[customer_email,customer_number]);
        if(offlineCustomerCheck.rows.length===0){
        await db.query("INSERT INTO offline_customer (full_name,email,mobile_number) VALUES($1,$2,$3)",[customer_name,customer_email,customer_number]);
        console.log("Successfully added offline customer details in the database");
        const customer_details=await db.query("SELECT * FROM offline_customer WHERE email=$1 OR mobile_number=$2",[customer_email,customer_number]);
        const customer_data=customer_details.rows[0];
        admin.invoiceGeneration(req,res,customer_data,items);
      }else{
        const customer_details=await db.query("SELECT * FROM offline_customer WHERE email=$1 OR mobile_number=$2",[customer_email,customer_number]);
        // console.log("Offline Customer already exist");
        const customer_data=customer_details.rows[0];
        admin.invoiceGeneration(req,res,customer_data,items);
        }
      }else{
        res.render("login.ejs");
      }
    } catch (error) {
      console.log("cannot get offline customer details",error);
    }
  });
  app.post("/generateBill",authenticateUser,async(req,res)=>{
    try {
      const {customer_name,customer_email,customer_number}=req.body;
      const {items}=req.body;//here items is like the array of objects
      // console.log(items);   
      if(req.user){
        const offlineCustomerCheck=await db.query("SELECT * FROM offline_customer WHERE email=$1 AND mobile_number=$2",[customer_email,customer_number]);
        if(offlineCustomerCheck.rows.length===0){
        await db.query("INSERT INTO offline_customer (full_name,email,mobile_number) VALUES($1,$2,$3)",[customer_name,customer_email,customer_number]);
        console.log("Successfully added offline customer details in the database");
        const customer_details=await db.query("SELECT * FROM offline_customer WHERE email=$1 OR mobile_number=$2",[customer_email,customer_number]);
        const customer_data=customer_details.rows[0];
        const billGenerationComplete=admin.billGeneration(req, res, customer_data, items);
        if(billGenerationComplete){
          for (const item of items) {
            await db.query("INSERT INTO orders_offline (email, name, mobile_number, item_name, item_id, item_type, amount, quantity) VALUES($1,$2,$3,$4,$5,$6,$7,$8)", 
            [customer_email, customer_name, customer_number, item.item_name, item.item_id, item.item_type, item.price, '1']);
            await db.query(
              `UPDATE stock_${item.item_type} SET quantity = quantity - $1 WHERE item_id = $2`,
              [1, item.item_id]
            );
          }     
          console.log("quantity updated through offline purchase");
        console.log("offline purchase complete adding details to database");
        }
      }else{
        const customer_details=await db.query("SELECT * FROM offline_customer WHERE email=$1 OR mobile_number=$2",[customer_email,customer_number]);
        // console.log("Offline Customer already exist");
        const customer_data=customer_details.rows[0];
        admin.billGeneration(req, res, customer_data, items)
        const billGenerationComplete=admin.billGeneration(req, res, customer_data, items);
        if(billGenerationComplete){
          for (const item of items) {
            await db.query("INSERT INTO orders_offline (email, name, mobile_number, item_name, item_id, item_type, amount, quantity) VALUES($1,$2,$3,$4,$5,$6,$7,$8)", 
            [customer_email, customer_name, customer_number, item.item_name, item.item_id, item.item_type, item.price, '1']);
            await db.query(
              `UPDATE stock_${item.item_type} SET quantity = quantity - $1 WHERE item_id = $2`,
              [1, item.item_id]
            );
        }
      }
        }
      }else{
        res.render("login.ejs");
      }
    } catch (error) {
      console.log("cannot get offline customer details",error);
    }
  });
  async function validateIndianZipCode(postalCode) {
    const apiKey = process.env.pinCodeApiKey; // Replace with your actual API key
    try {
      const response = await axios.get(
        `https://www.zipcodeapi.com/rest/${apiKey}/info.json/${postalCode}/degrees`
      );
      return response.data;
    } catch (error) {
      console.error("Error validating postal code:", error);
      return false;
    }
  }
  //admin panel functionality ends here
  //new functionlaity starts here
  //functionality for tours booking starts here
  // app.get("/BookMyTour",authenticateUser,async(req,res)=>{
  //   if(req.user){
  //     try {
  //       const firstName =req.user.fullName.split(" ")[0] ;
  //       const data =await db.query("Select * from tours where status=$1",["Active"]);
  //       const result=data.rows;
  //       res.render("ToursBooking.ejs",{
  //         tours_data:result,
  //         Login:firstName,
  //       })
  //     } catch (error) {
  //           console.log("Unable to fetch tours data from database");
  //     }
  //   }else{
  //     const data =await db.query("Select * from tours where status=$1",["Active"]);
  //     const result=data.rows;
  //     res.render("ToursBooking.ejs",{
  //       tours_data:result,
  //       Login:null,
  //     })
  //   }
  // })
  // app.post("/CompleteTourBooking",authenticateUser,(req,res)=>{

  // })
  
  //functionality for tours booking ends here

db.connect();
app.listen(port, () => {
  console.log(`Listening on port:${port}`);
});