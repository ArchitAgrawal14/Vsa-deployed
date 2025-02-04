import express from "express";
import bodyParser from "body-parser";
import * as admin from "./admin.js";
import Razorpay from "razorpay";
import { v4 as uuidv4 } from "uuid";
import multer from "multer";
import nodemailer from "nodemailer";
import crypto from "crypto";
import pg from "pg"; // Import only Pool from pg
import jwt from "jsonwebtoken";
import path from "path";
import { Strategy } from "passport-local";
import GoogleStrategy from "passport-google-oauth2";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import axios from "axios";
import { fileURLToPath } from "url";
import { dirname } from "path";
import dotenv from "dotenv";
import passport from "passport";

dotenv.config();

// import mysql from 'mysql2';

const app = express();
const _dirname = dirname(fileURLToPath(import.meta.url));
const port = process.env.SERVER_PORT;
const { Pool } = pg;

// const port=3000;

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
// app.use((req, res, next) => {
//   res.removeHeader('Cross-Origin-Opener-Policy');
//   res.removeHeader('Cross-Origin-Embedder-Policy');
//   next();
// });

const Secret_key = process.env.jwtSecretKey;

//Database_url mei internal server ka link dala jaata hai
// const db = new pg.Client({
//   host: process.env.databaseHost,       // Fetch from env
//   user: process.env.DATABASE_USER,       // Fetch from env
//   password: process.env.databasePassword, // Fetch from env
//   database: process.env.DATABASE_NAME || "vsa",  // Fetch from env with a fallback
//   port: process.env.DATABASE_PORT || 4000 // Fetch from env with default 5432
// });

// Connect to the database
// connection.connect((err) => {
//   if (err) {
//     console.error('Error connecting to the database:', err.stack);
//     return;
//   }
//   console.log('Connected to the database as id ' + connection.threadId);
// });

// export default connection;

const db = new Pool({
  host: process.env.DATABASE_HOST,       // Fetch from env
  user: process.env.DATABASE_USER,       // Fetch from env
  password: process.env.DATABASE_PASSWORD, // Fetch from env
  database: process.env.DATABASE_NAME || "vsa_database",  // Fetch from env with a fallback
  port: process.env.DATABASE_PORT || 5432, // Fetch from env with default 5432
  ssl: {
    rejectUnauthorized: false, // Required for Render-managed PostgreSQL
  },
});



app.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

passport.use(
  "google",
  new GoogleStrategy(
    {
      // This below is for local host
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/secrets",
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
      passReqToCallback: true, // This allows accessing req in the verify callback

      // //This below is for render`
      // clientID: process.env.GOOGLE_CLIENT_ID,
      // clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // callbackURL: "https://vsa-deployed.onrender.com/auth/google/secrets",
      // userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
      // passReqToCallback: true // This allows accessing req in the verify callback
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        // Check if user exists
        let duplicateCheck = await db.query(
          `SELECT * FROM users WHERE email=$1;`,
          [profile.emails[0].value]
        );

        let user, token;
        if (duplicateCheck.rows.length > 0) {
          // Existing user
          user = duplicateCheck.rows[0];
        } else {
          // New user
          const user_id = uuidv4();
          const newUserResult = await db.query(
            "INSERT INTO users (full_name, email, user_id ,password_entered) VALUES ($1, $2, $3, $4) RETURNING *",
            [
              profile.displayName,
              profile.emails[0].value,
              user_id,
              "Logged in via google",
            ]
          );
          user = newUserResult.rows[0];
        }

        // Generate token
        token = jwt.sign(
          {
            Email: user.email,
            fullName: user.full_name,
            user_id: user.id,
          },
          Secret_key,
          { expiresIn: "3d" }
        );

        return done(null, { user, token });
      } catch (error) {
        return done(error);
      }
    }
  )
);

// Modify the Google callback route
app.get(
  "/auth/google/secrets",
  passport.authenticate("google", {
    failureRedirect: "/newLogin",
    session: false, // Disable session
  }),
  (req, res) => {
    // Set cookie with the token
    res.cookie("token", req.user.token, { httpOnly: true, secure: true });

    // Redirect based on user
    const firstName = req.user.user.full_name.split(" ")[0];
    res.redirect("/");
  }
);

// Add this middleware to set the user from the token
app.use((req, res, next) => {
  const token = req.cookies.token;

  if (token) {
    try {
      const decoded = jwt.verify(token, Secret_key);
      req.user = decoded;
    } catch (err) {
      req.user = null;
    }
  }
  next();
});
// Endpoint to start Google OAuth process
app.get("/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false, // Explicitly disable session
  })
);

app.post("/SignUp", async (req, res) => {
  const { FullName, SignUp_Email, SignUp_Password, Mobile_number } = req.body;
  const saltRounds = 10;
  const user_id = uuidv4();
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
      const verificationToken = crypto.randomBytes(32).toString("hex");

      // Insert user with verification token and 'isVerified' flag set to false
      await db.query(
        "INSERT INTO users (full_name, email, password_entered, mobile_number,user_id, admin, verification_token, is_verified) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
        [
          FullName,
          SignUp_Email,
          hashedPassword,
          Mobile_number,
          user_id,
          false,
          verificationToken,
          false,
        ]
      );

      // Send verification email
      const transporter = nodemailer.createTransport({
        service: "gmail", // You can use other services too like Outlook, SMTP etc.
        auth: {
          user: process.env.nodeMailerEmailValidatorEmail, // Your email
          pass: process.env.nodeMailerEmailValidatorPass, // Your email password or app password
        },
      });

      // const verificationLink = `http://localhost:3000/verify-email?token=${verificationToken}`;
      const verificationLink = `https://vsa-deployed.onrender.com/verify-email?token=${verificationToken}`;

      const mailOptions = {
        from: process.env.nodeMailerEmailValidatorEmail,
        to: SignUp_Email,
        subject: "Verify your email for sign-up",
        html: `<p>Hi ${firstName},</p>
                 <p>Please click the link below to verify your email:</p>
                 <a href="${verificationLink}">Verify Email</a>`,
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
      errorMessage: "An error occurred during sign up, please try again.",
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
        message:
          "Your email has been verified successfully! You can now log in.",
        redirectTo: "/newLogin",
        delay: 2000, // Delay in milliseconds before redirecting
      });
    } else {
      // Render the failure page
      res.render("verificationFailure.ejs", {
        message: "Email verification failed. Please try again.",
        redirectTo: "/newLogin",
        delay: 2500, // Delay in milliseconds before redirecting
      });
    }
  } catch (error) {
    console.error("Error during email verification:", error);
    // Render the failure page
    res.render("verificationFailure", {
      message: "Email verification failed. Please try again.",
      redirectTo: "/newLogin",
      delay: 2500, // Delay in milliseconds before redirecting
    });
  }
});

app.post("/Login", async (req, res) => {
  const { Email, Password } = req.body;
  try {
    const enteredDetails = await db.query(
      "SELECT * FROM users WHERE email=$1;",
      [Email]
    );
    if (enteredDetails.rows.length > 0) {
      const userCheck = enteredDetails.rows[0];
      if (userCheck.admin === true) {
        console.log("User is admin");
        const PassCheck = await bcrypt.compare(
          Password,
          userCheck.password_entered
        );
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
          admin.adminRole(req, res, firstName);
        } else {
          console.log("Invalid Credentials");
          res.render("login.ejs", {
            login_toolTip: true,
          });
        }
      } else {
        console.log("userCheck:", userCheck); // Debugging log

        const PassCheck = await bcrypt.compare(
          Password,
          userCheck.password_entered
        );

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

app.get("/", authenticateUser, async (req, res) => {
  if (req.user) {
    const firstName = req.user.fullName.split(" ")[0];
    const { rows: homePageData } = await db.query(
      "SELECT * FROM home_page_data"
    );
    res.render("index.ejs", {
      Login: firstName,
      homePageData: homePageData,
    });

    console.log(
      `Successfully opened Home with user logged in: ${req.user.fullName}`
    );
  } else {
    const { rows: homePageData } = await db.query(
      "SELECT * FROM home_page_data"
    );
    res.render("index.ejs", {
      Login: null,
      homePageData: homePageData,
    });
    console.log("Sucessfully opened Home without user logged in");
  }
});
app.get("/Shop", authenticateUser, async (req, res) => {
  if (req.user) {    
    try {
    //   const { rows: item_data } = await db.query("SELECT * FROM stock_skates");
    //   console.log(
    //     "Stocks successfully retrieved from database with user login"
    //   );
    //   res.render("Shop.ejs", {
    //     Login: firstName,
    //     items_data: item_data,
    //   });
    //   console.log(
    //     "Sucessfully opened shop with user log in and item displayed"
    //   );

    renderItems(req, res, "Skates", "stock_skates");
    } catch (error) {
      console.log("Unable to retrive stock", error);
    }
  } else {
    const { rows: item_data } = await db.query(`SELECT 
        s.item_id,           
        s.item_type,         
        s.img,               
        s.name,
        s.price,
        ARRAY_AGG(pd.size) AS sizes,  
        ARRAY_AGG(pd.color) AS colors 
        FROM stock_skates s
        LEFT JOIN product_details pd ON s.item_id = pd.item_id
        GROUP BY 
        s.item_id,           
        s.item_type,
        s.img,
        s.name,
        s.price`);
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

// Razorpay instance setup
// app.post("/Buy_Now", authenticateUser, async (req, res) => {
//   const { item_id, item_type, quantity, size, color } = req.body;

//   if (!req.user) {
//     console.log("User not logged in, unable to process purchase.");
//     return res.status(401).render("login.ejs", {
//       message: "You must be logged in to purchase items.",
//     });
//   }
//   const validItemTypes = ['skates', 'accessories','helmets','skinsuits','wheels']; // define valid types
//   if (!validItemTypes.includes(item_type)) {
//     return res.status(400).json({ error: "Invalid item type" });
//   }
//   if (!Number.isInteger(quantity) || quantity <= 0) {
//     return res.status(400).json({ error: "Invalid quantity" });
//   }
//   const client = await db.connect(); // Start a database client connection

//   try {
//     await client.query("BEGIN"); // Start a transaction block

//     // Check user details
//     const user_check = await client.query(
//       "SELECT * FROM users WHERE email = $1",
//       [req.user.Email]
//     );
//     const user_check_address = await client.query(
//       "SELECT * FROM users_address WHERE email = $1",
//       [req.user.Email]
//     );

//     if (user_check.rows.length === 0 || user_check_address.rows.length === 0) {
//       console.log("User or address details not found.");
//       return res
//         .status(404)
//         .json({ error: "User or address details not found." });
//     }

//     const { name: full_name, email, mobile_number } = user_check.rows[0];
//     const { address, zip_code, city, state } = user_check_address.rows[0];

//     // Check item stock with version
//     const itemCheck = await client.query(
//       `SELECT * FROM stock_${item_type} WHERE item_id = $1`,
//       [item_id]
//     );

//     if (itemCheck.rows.length === 0) {
//       console.log("Item not found.");
//       return res.status(404).json({ error: "Item not found." });
//     }

//     const purchase = itemCheck.rows[0];
//     const currentVersion = purchase.version; // Current version of the stock row
//     const stockQuantity = purchase.quantity;
//     const newQuantity = Math.min(parseInt(quantity), stockQuantity);

//     if (newQuantity > stockQuantity) {
//       console.log(
//         `Insufficient stock for item_id ${item_id}, requested: ${newQuantity}, available: ${stockQuantity}`
//       );
//       return res.status(400).json({ error: "Insufficient stock" });
//     }

//     // Attempt to update stock using optimistic locking
//     const updateResult = await client.query(
//       `UPDATE stock_${item_type}
//         SET quantity = quantity - $1, version = version + 1
//         WHERE item_id = $2 AND version = $3`,
//       [newQuantity, item_id, currentVersion]
//     );

//     // If no rows were updated, it means the version was outdated
//     if (updateResult.rowCount === 0) {
//       console.log("Stock has been updated by another transaction.");
//       return res.status(409).json({
//         error:
//           "The stock has been updated by another transaction. Please try again.",
//       });
//     }

//     // Insert into orders with a pending status
//     await client.query(
//       "INSERT INTO orders (name, email, mobile_number, address, zip_code, city, state, item_id, item_type, price, quantity, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending')",
//       [
//         full_name,
//         email,
//         mobile_number,
//         address,
//         zip_code,
//         city,
//         state,
//         item_id,
//         item_type,
//         purchase.price,
//         newQuantity,
//       ]
//     );

//     // Create Razorpay order
//     const orderOptions = {
//       amount: purchase.price * newQuantity, // amount in the smallest currency unit
//       currency: "INR",
//       receipt: `receipt_order_${item_id}_${Date.now()}`,
//     };

//     const order = await razorpayInstance.orders.create(orderOptions);

//     await client.query("COMMIT"); // Commit the transaction if all queries succeed

//     res.status(200).json({
//       id: order.id,
//       currency: order.currency,
//       amount: order.amount,
//       full_name,
//       email,
//       mobile_number,
//       address,
//     });
//   } catch (error) {
//     await client.query("ROLLBACK"); // Rollback the transaction in case of error
//     console.error("Error processing purchase:", error);
//     res
//       .status(500)
//       .json({ error: "An error occurred while processing your purchase." });
//   } finally {
//     client.release(); // Release the client back to the pool
//   }
// });

// app.post("/payment_success", async (req, res) => {
//   const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
//     req.body;

//   // Verification of payment signature
//   const razorpaySecret = process.env.RAZORPAY_SECRET; // Store secret securely
//   const hmac = crypto.createHmac("sha256", razorpaySecret);
//   hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
//   const generated_signature = hmac.digest("hex");

//   if (generated_signature === razorpay_signature) {
//     // Payment verified
//     const client = await db.connect(); // Start a database client connection

//     try {
//       await client.query("BEGIN"); // Start a transaction block

//       // Find the order with the given Razorpay order ID and mark it as paid
//       const order = await client.query(
//         "SELECT * FROM orders WHERE order_id = $1",
//         [razorpay_order_id]
//       );

//       if (order.rows.length === 0) {
//         return res
//           .status(404)
//           .json({ success: false, error: "Order not found" });
//       }

//       const orderDetails = order.rows[0];
//       const { item_id, item_type, quantity } = orderDetails;

//       // Use optimistic locking during the stock update
//       const itemCheck = await client.query(
//         `SELECT * FROM stock_${item_type} WHERE item_id = $1`,
//         [item_id]
//       );

//       const currentVersion = itemCheck.rows[0].version;

//       const updateStockResult = await client.query(
//         `UPDATE stock_${item_type} SET quantity = quantity - $1, version = version + 1 WHERE item_id = $2 AND version = $3`,
//         [quantity, item_id, currentVersion]
//       );

//       // If no rows were updated, it means the version was outdated
//       if (updateStockResult.rowCount === 0) {
//         console.log(
//           "Stock has been updated by another transaction after payment verification."
//         );
//         return res.status(409).json({
//           success: false,
//           error:
//             "The stock has been updated by another transaction. Please try again.",
//         });
//       }

//       // Update order status to 'completed'
//       await client.query(
//         "UPDATE orders SET status = 'completed', payment_id = $1 WHERE order_id = $2",
//         [razorpay_payment_id, razorpay_order_id]
//       );

//       await client.query("COMMIT"); // Commit the transaction if all queries succeed

//       res.json({ success: true });
//     } catch (error) {
//       await client.query("ROLLBACK"); // Rollback the transaction in case of error
//       console.error("Error processing payment:", error);
//       res.status(500).json({ success: false, error: "Database update failed" });
//     } finally {
//       client.release(); // Release the client back to the pool
//     }
//   } else {
//     res
//       .status(400)
//       .json({ success: false, error: "Signature verification failed" });
//   }
// });

const validateItemType = (req, res, next) => {
  const validItemTypes = ['skates', 'accessories', 'helmets', 'skinsuits', 'wheels'];
  if (!validItemTypes.includes(req.body.item_type)) {
    return res.status(400).json({ error: "Invalid item type" });
  }
  next();
};

// Buy Now endpoint
app.post("/Buy_Now", authenticateUser, validateItemType, async (req, res) => {
  // Input validation
  const validateInput = (data) => {
      const { item_id, item_type, quantity, size, color } = data;
      if (!item_id || !item_type || !size || !color) {
          throw new Error("Missing required fields");
      }
      const parsedQuantity = parseInt(quantity);
      if (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
          throw new Error("Invalid quantity");
      }
      return parsedQuantity;
  };

  const client = await db.connect();

  try {
      const parsedQuantity = validateInput(req.body);
      const { item_id, item_type, size, color } = req.body;

      await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");

      // Batch fetch user and product data
      const [userQuery, addressQuery, productQuery] = [
          `SELECT name, email, mobile_number 
           FROM users 
           WHERE email = $1`,
          `SELECT address, zip_code, city, state 
           FROM users_address 
           WHERE email = $1`,
          `SELECT pd.*, s.quantity as stock_quantity, s.version 
           FROM product_details pd
           JOIN stock_${item_type} s ON pd.item_id = s.item_id
           WHERE pd.item_id = $1 
           AND pd.size = $2 
           AND pd.color = $3
           FOR UPDATE`
      ];

      const [userResult, addressResult, productResult] = await Promise.all([
          client.query(userQuery, [req.user.Email]),
          client.query(addressQuery, [req.user.Email]),
          client.query(productQuery, [item_id, size, color])
      ]);

      if (!userResult.rows.length || !addressResult.rows.length) {
          throw Object.assign(
              new Error("User or address details not found"),
              { status: 404 }
          );
      }

      if (!productResult.rows.length) {
          throw Object.assign(
              new Error("Product variant not found"),
              { status: 404 }
          );
      }

      const { name, email, mobile_number } = userResult.rows[0];
      const { address, zip_code, city, state } = addressResult.rows[0];
      const product = productResult.rows[0];

      // Validate stock availability
      if (parsedQuantity > product.stock_quantity) {
          throw Object.assign(
              new Error(`Insufficient stock. Available: ${product.stock_quantity}`),
              { status: 400 }
          );
      }

      // Create Razorpay order
      const totalAmount = Math.round(product.price * parsedQuantity * 100);
      const razorpayOrder = await razorpayInstance.orders.create({
          amount: totalAmount,
          currency: "INR",
          notes: {
              item_type,
              size,
              color,
              quantity: parsedQuantity,
              user_email: email
          }
      }).catch(error => {
          throw Object.assign(
              new Error("Failed to create payment order"),
              { status: 502, originalError: error }
          );
      });

      // Batch database updates
      const [stockUpdateQuery, productUpdateQuery, orderInsertQuery] = [
          `UPDATE stock_${item_type}
           SET quantity = quantity - $1,
               version = version + 1
           WHERE item_id = $2 
           AND version = $3
           AND quantity >= $1
           RETURNING *`,
          `UPDATE product_details
           SET quantity = quantity - $1
           WHERE item_id = $2 
           AND size = $3 
           AND color = $4
           AND quantity >= $1
           RETURNING *`,
          `INSERT INTO orders (
              order_id, name, email, mobile_number, 
              address, zip_code, city, state,
              item_id, item_type, price, quantity, 
              size, color, status, created_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'pending', CURRENT_TIMESTAMP)
           RETURNING id`
      ];

      const [stockUpdate, productUpdate, orderInsert] = await Promise.all([
          client.query(stockUpdateQuery, [parsedQuantity, item_id, product.version]),
          client.query(productUpdateQuery, [parsedQuantity, item_id, size, color]),
          client.query(orderInsertQuery, [
              razorpayOrder.id, name, email, mobile_number,
              address, zip_code, city, state,
              item_id, item_type, product.price, parsedQuantity,
              size, color
          ])
      ]);

      if (!stockUpdate.rows.length || !productUpdate.rows.length) {
          throw Object.assign(
              new Error("Stock update failed - concurrent modification detected"),
              { status: 409 }
          );
      }

      await client.query("COMMIT");

      res.status(200).json({
          order_id: razorpayOrder.id,
          currency: razorpayOrder.currency,
          amount: razorpayOrder.amount,
          name,
          email,
          mobile_number,
          address,
          transaction_id: orderInsert.rows[0].id
      });

  } catch (error) {
      await client.query("ROLLBACK");
      console.error("Purchase processing error:", {
          error: error.message,
          originalError: error.originalError,
          stack: error.stack,
          user: req.user.Email,
          item: req.body.item_id
      });

      res.status(error.status || 500).json({ 
          error: error.message || "An error occurred while processing your purchase"
      });

  } finally {
      client.release();
  }
});
// Payment Success endpoint
app.post("/payment_success", authenticateUser, async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: "Missing required payment parameters" });
  }

  const client = await db.connect();

  try {
      // Verify payment signature
      const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_SECRET);
      hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
      const generated_signature = hmac.digest("hex");

      if (generated_signature !== razorpay_signature) {
          throw new Error("Invalid payment signature");
      }

      await client.query("BEGIN");

      // Get order details with lock
      const orderResult = await client.query(
          `SELECT o.* 
           FROM orders o
           WHERE o.order_id = $1 AND o.status = 'pending'
           FOR UPDATE`,
          [razorpay_order_id]
      );

      if (orderResult.rows.length === 0) {
          throw new Error("Order not found or already processed");
      }

      const order = orderResult.rows[0];

      // Verify payment amount with Razorpay
      const payment = await razorpayInstance.payments.fetch(razorpay_payment_id);
      
      if (payment.order_id !== razorpay_order_id) {
          throw new Error("Payment verification failed: Order ID mismatch");
      }

      // Update order status
      await client.query(
          `UPDATE orders 
           SET status = 'completed', 
               payment_id = $1
           WHERE order_id = $2`,
          [razorpay_payment_id, razorpay_order_id]
      );

      await client.query("COMMIT");

      res.json({
          success: true,
          order_id: razorpay_order_id,
          payment_id: razorpay_payment_id
      });

  } catch (error) {
      await client.query("ROLLBACK");
      console.error("Payment verification error:", error);
      
      res.status(error.status || 500).json({
          success: false,
          error: error.message || "Payment verification failed"
      });

  } finally {
      client.release();
  }
});

app.post("/CheckOut", authenticateUser, async (req, res) => {
  if (!req.user) {
    return res
      .status(401)
      .json({ success: false, message: "User not logged in." });
  }
  const { item_id, item_type, quantity, size, color } = req.body;
  console.log(item_id, item_type, quantity, size, color);
  if (!item_id || !item_type || !quantity || !size || !color) {
    return res
      .status(400)
      .json({ success: false, message: "Missing required fields." });
  }

  // Query the database for the item details and check available stock
  const data = await db.query(
    `SELECT * FROM stock_${item_type} WHERE item_id=$1 AND quantity >= $2`,
    [item_id, quantity]
  );
  const items_data = data.rows;

  if (!items_data.length) {
    return res
      .status(404)
      .json({ success: false, message: "Insufficient stock" });
  }

  res.json({ success: true, items_data: items_data });
});

app.get("/checkOutPage", authenticateUser, async (req, res) => {
  try {
    if (req.user) {
      const firstName = req.user.fullName.split(" ")[0];
      const { item_id, item_type, quantity } = req.query;
      console.log(
        "Fetching product with ID:",
        item_id,
        "of type:",
        item_type,
        "Quantity: ",
        quantity
      );

      if (!item_id || !item_type) {
        console.error(
          "Missing item_id or item_type in the request for checkout page"
        );
        return res.status(400).send("Bad Request: Missing item ID or type.");
      }

      // Fetch product details from the database
      const data = await db.query(
        `SELECT * FROM stock_${item_type} WHERE item_id=$1 AND quantity>=$2`,
        [item_id, quantity]
      );
      const result = data.rows;
      const UserSelectedItems = quantity;
      if (!result.length) {
        return res.status(404).send("Item not found");
      }
      res.render("checkOutPage.ejs", {
        items_data: result,
        Login: firstName,
        UserSelectedItems: UserSelectedItems,
      });
    }
  } catch (error) {
    res.render("login.ejs");
    console.log("User is not logged in and is trying to buy an item");
  }
});

app.get("/productDetails", authenticateUser, async (req, res) => {
  try {
    const { item_id, item_type } = req.query;
    
    // Log the incoming parameters
    console.log("Fetching product with ID:", item_id, "of type:", item_type);
    
    // Validate required parameters
    if (!item_id || !item_type) {
      console.error("Missing item_id or item_type in the request");
      return res.status(400).send("Bad Request: Missing item ID or type.");
    }
    
    // Fetch basic product details
    const productData = await db.query(
      `SELECT * FROM stock_${item_type} WHERE item_id=$1`,
      [item_id]
    );
    
    // Fetch additional product details
    const variantData = await db.query(
      `SELECT img, size, color FROM product_details WHERE item_id=$1`,
      [item_id]
    );
    
    const productResult = productData.rows;
    const variantResult = variantData.rows;
    
    // Check if product exists
    if (!productResult.length) {
      return res.status(404).send("Item not found");
    }
    
    // Prepare the combined data object
    const combinedItemDetails = {
      ...productResult,  // Basic product details
      variants: variantResult  // Array of variants with size, color, and images
    };
    
    console.log(combinedItemDetails);
    // Get user's first name if logged in
    const firstName = req.user ? req.user.fullName.split(" ")[0] : null;
    
    // Render the page with combined data
    res.render("product_Details.ejs", {
      itemDetails: combinedItemDetails,
      Login: firstName
    });
    
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
      const data = await db.query(
        `SELECT * FROM stock_${item_type} WHERE item_id=$1`,
        [item_id]
      );
      const result = data.rows;

      if (!result.length) {
        return res
          .status(404)
          .json({ success: false, message: "Item not found" });
      }

      res.json({ success: true, itemDetails: result, Login: firstName });
    } else {
      //displaying product details page even without user login
      const { item_id, item_type } = req.body;
      const data = await db.query(
        `SELECT * FROM stock_${item_type} WHERE item_id=$1`,
        [item_id]
      );
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
    const { rows: item_data } = await db.query(`
        SELECT 
        s.item_id,           
        s.item_type,         
        s.img,               
        s.name,
        s.price,
        ARRAY_AGG(pd.size) AS sizes,  
        ARRAY_AGG(pd.color) AS colors 
        FROM ${tableName} s
        LEFT JOIN product_details pd ON s.item_id = pd.item_id
        GROUP BY 
        s.item_id,           
        s.item_type,
        s.img,
        s.name,
        s.price

    `);

    console.log(
      `Stocks successfully retrieved ${productType} from database ${
        req.user ? "with" : "without"
      } user login`
    );

    res.render("Shop.ejs", {
      Login: firstName,
      items_data: item_data,
    });
    console.log(
      `Successfully opened ${productType} ${
        req.user ? "with" : "without"
      } user logged in`
    );
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
  renderItems(req, res, "Skates", "stock_skates");
});

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

    const { item_id, item_type, quantity, color, size } = req.body;
    console.log("Item details:", { item_id, item_type, quantity, color, size });

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
    let colorName=getColorName(color);
    if (itemCheckInCart.rows.length === 0) {
      const insertQuantity =
        quantity <= availableItemQuantity ? quantity : availableItemQuantity;
      await db.query(
        "INSERT INTO cart (user_id, img, name, description, item_id, price, quantity,color,size) VALUES ($1, $2, $3, $4, $5, $6, $7,$8,$9)",
        [
          userId,
          item.img,
          item.name,
          item.description,
          item.item_id,
          item.price,
          insertQuantity,
          colorName,
          size,
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

    res
      .status(200)
      .json({ success: true, message: "Item added to cart successfully" });
  } catch (error) {
    console.error("Error in /AddToCart:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

// Below is the function for color decoding
function getColorName(hexCode) {
  const colorNameMap = {
    "#000000": "Black",
    "#FFFFFF": "White",
    "#FF0000": "Red",
    "#00FF00": "Green",
    "#0000FF": "Blue",
    "#FFFF00": "Yellow",
    "#FFA500": "Orange",
    "#800080": "Purple",
    "#808080": "Gray",
    "#C0C0C0": "Silver",
    "#A52A2A": "Brown",
    "#008000": "Dark Green",
    "#ADD8E6": "Light Blue",
    "#FFC0CB": "Pink",
    "#FFD700": "Gold",
    "#FF4500": "Orange Red",
    "#D2691E": "Chocolate",
    "#4B0082": "Indigo",
    "#800000": "Maroon",
    "#00FFFF": "Cyan",
    "#4682B4": "Steel Blue",
    "#DC143C": "Crimson",
    "#8A2BE2": "Blue Violet",
    "#5F9EA0": "Cadet Blue",
    "#FF69B4": "Hot Pink",
    "#7FFF00": "Chartreuse",
    "#48D1CC": "Medium Turquoise",
    "#191970": "Midnight Blue",
    "#708090": "Slate Gray",
    "#2E8B57": "Sea Green",
    "#F0E68C": "Khaki",
    "#20B2AA": "Light Sea Green",
    "#778899": "Light Slate Gray",
    "#B22222": "Fire Brick",
    "#B8860B": "Dark Goldenrod",
  };
  

  return colorNameMap[hexCode.toUpperCase()] || "Unknown Color";
}

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
    console.log(
      req.user
        ? "Successfully opened Cart with user log in"
        : "Successfully opened Cart without user logged in"
    );
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
        res
          .status(404)
          .json({ success: false, error: "Item not found in cart" });
      } else {
        console.log("Item successfully deleted from cart and database");
        res
          .status(200)
          .json({ success: true, message: "Item removed from cart" });
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


//yaha pe join us ka hai with razor pay
app.get("/joinUs", authenticateUser, (req, res) => {
  if (req.user) {
    res.render("joinUs.ejs");
  } else {
    res.redirect("/newlogin");
  }
});

// Endpoint for payment processing on the frontend for student registration
// app.post('/joinUsStudentRegistered', async (req, res) => {
//   // Connect to the database
//   await db.connect(); // Connect to the database using the pg.Client instance

//   try {
//     // Start the transaction
//     await db.query('BEGIN');

//     // Check if the user is logged in (or any necessary validation)
//     if (req.user) {
//       const { Student_Name, Mother_name, Father_name, mobile_number, email, feeStructure, terms } = req.body;

//       // Calculate amount based on the fee structure
//       let amount;
//       if (feeStructure === '1_month') {
//         amount = 2000 * 100; // Convert to paise
//       } else if (feeStructure === '3_month') {
//         amount = 5500 * 100;
//       } else if (feeStructure === '6_month') {
//         amount = 10000 * 100;
//       } else if (feeStructure === '11_month') {
//         amount = 16000 * 100;
//       }

//       // Razorpay order creation options
//       const options = {
//         amount: amount, // Amount in paise
//         currency: 'INR',
//         receipt: crypto.randomBytes(10).toString('hex'), // Unique receipt ID
//         notes: {
//           studentName: Student_Name,
//         },
//       };

//       // Create Razorpay order
//       const order = await razorpay.orders.create(options);

//       // If Razorpay order creation is successful, save student details to PostgreSQL
//       const insertStudentQuery = `
//         INSERT INTO students_registration (Student_Name, Mother_name, Father_name, mobile_number, email, feeStructure, terms, razorpay_order_id, payment_status)
//         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id;
//       `;

//       const studentValues = [
//         Student_Name,
//         Mother_name,
//         Father_name,
//         mobile_number,
//         email,
//         feeStructure,
//         terms,
//         order.id, // Store Razorpay order ID
//         'Pending', // Payment status
//       ];

//       // Execute the insert query for student details
//       const studentResult = await db.query(insertStudentQuery, studentValues);

//       // If everything is successful, commit the transaction
//       await db.query('COMMIT');

//       // Respond with Razorpay order details
//       res.json({
//         orderId: order.id,
//         amount: order.amount,
//         currency: order.currency,
//       });
//     }
//   } catch (error) {
//     // If an error occurs, rollback the transaction
//     await db.query('ROLLBACK');
//     console.error('Transaction error:', error);
//     res.status(500).send({ error: 'Something went wrong, please try again' });
//   } finally {
//     // Release the client back to the pool (not necessary in this case since we are using a single client)
//     db.end(); // You should explicitly close the connection when using `pg.Client` in this case
//   }
// });

// // Endpoint to verify payment after successful payment on the frontend for student registration
// app.post('/verify-payment', async (req, res) => {
//   const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

//   // Verify the payment signature
//   const body = razorpay_order_id + "|" + razorpay_payment_id;
//   const expectedSignature = crypto.createHmac('sha256', 'YOUR_RAZORPAY_SECRET')
//                                    .update(body)
//                                    .digest('hex');

//   if (expectedSignature === razorpay_signature) {
//     // Payment is verified, now process the payment and update the database
//     try {
//       // Connect to the database
//       await db.connect();

//       // Start the transaction
//       await db.query('BEGIN');

//       // Update the payment status in the database
//       const updatePaymentStatusQuery = `
//         UPDATE students_registration
//         SET payment_status = $1, razorpay_payment_id = $2
//         WHERE razorpay_order_id = $3 RETURNING id;
//       `;
//       const updateValues = ['Success', razorpay_payment_id, razorpay_order_id];

//       // Execute the update query
//       const result = await db.query(updatePaymentStatusQuery, updateValues);

//       if (result.rowCount > 0) {
//         // If the student record was found and updated, commit the transaction
//         await db.query('COMMIT');
//         res.send('Payment verified and processed');
//       } else {
//         // If no matching record is found
//         await db.query('ROLLBACK');
//         res.status(400).send('Order not found');
//       }
//     } catch (error) {
//       // Rollback the transaction if an error occurs
//       await db.query('ROLLBACK');
//       console.error('Payment verification failed:', error);
//       res.status(500).send('Payment verification failed');
//     } finally {
//       // Close the database connection
//       db.end();
//     }
//   } else {
//     res.status(400).send('Payment verification failed');
//   }
// });

//yaha pe join us ka end hai

//
app.post("/joinUsStudentRegistered", authenticateUser, async (req, res) => {
  try {
    await db.connect(); // Connect to the database
    await db.query("BEGIN"); // Start the transaction

    if (req.user) {
      const {
        Student_Name,
        Mother_name,
        Father_name,
        mobile_number,
        email,
        feeStructure,
        terms,
      } = req.body;

      // Calculate amount based on the fee structure
      let amount;
      if (feeStructure === "1_month") {
        amount = 2000 * 100; // Convert to paise
      } else if (feeStructure === "3_month") {
        amount = 5500 * 100;
      } else if (feeStructure === "6_month") {
        amount = 10000 * 100;
      } else if (feeStructure === "11_month") {
        amount = 16000 * 100;
      }

      // Razorpay order creation options
      const options = {
        amount: amount, // Amount in paise
        currency: "INR",
        receipt: crypto.randomBytes(10).toString("hex"), // Unique receipt ID
        notes: {
          studentName: Student_Name,
        },
      };

      // Create Razorpay order
      const order = await razorpay.orders.create(options);

      // If Razorpay order creation is successful, save student details to PostgreSQL
      const insertStudentQuery = `
        INSERT INTO students_registration (Student_Name, Mother_name, Father_name, mobile_number, email, feeStructure, terms, razorpay_order_id, payment_status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id;
      `;

      const studentValues = [
        Student_Name,
        Mother_name,
        Father_name,
        mobile_number,
        email,
        feeStructure,
        terms,
        order.id, // Store Razorpay order ID
        "Pending", // Payment status
      ];

      const studentResult = await db.query(insertStudentQuery, studentValues);

      await db.query("COMMIT"); // Commit the transaction

      res.json({
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
      });
    }
  } catch (error) {
    await db.query("ROLLBACK"); // Rollback the transaction in case of error
    console.error("Transaction error:", error);
    res.status(500).send({ error: "Something went wrong, please try again" });
  } finally {
    db.end(); // Close the connection after request handling
  }
});

app.post("/verify-payment", authenticateUser, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", "YOUR_RAZORPAY_SECRET")
      .update(body)
      .digest("hex");

    if (expectedSignature === razorpay_signature) {
      await db.connect(); // Connect to the database for payment verification
      await db.query("BEGIN"); // Start the transaction

      const updatePaymentStatusQuery = `
        UPDATE students_registration
        SET payment_status = $1, razorpay_payment_id = $2
        WHERE razorpay_order_id = $3 RETURNING id;
      `;
      const updateValues = ["Success", razorpay_payment_id, razorpay_order_id];

      const result = await db.query(updatePaymentStatusQuery, updateValues);

      if (result.rowCount > 0) {
        await db.query("COMMIT");
        res.send("Payment verified and processed");
      } else {
        await db.query("ROLLBACK");
        res.status(400).send("Order not found");
      }
    } else {
      res.status(400).send("Payment verification failed");
    }
  } catch (error) {
    await db.query("ROLLBACK"); // Rollback the transaction in case of error
    console.error("Payment verification failed:", error);
    res.status(500).send("Payment verification failed");
  } finally {
    db.end(); // Close the connection after request handling
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
              [hashedPassword, email]
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

// yaha pe previous orders page ke liye hai for users not admin below two endpoints.
app.get("/Orders", authenticateUser, async (req, res) => {
  try {
    const userResult = await db.query(`SELECT * FROM users WHERE email=$1`, [
      req.user.Email,
    ]);

    if (userResult.rows.length === 0) {
      console.log("User was not logged in");
      return res.redirect("/newLogin");
    }

    // Fetch orders first
    const userOrders = await db.query(
      `SELECT order_id, status, item_id, item_type FROM orders WHERE email = $1 ORDER BY order_id DESC`,
      [req.user.Email]
    );

    let allOrdersData = [];

    // Loop through orders and fetch corresponding stock data dynamically
    for (const order of userOrders.rows) {
      const stockTable = `stock_${order.item_type}`;
      const stockQuery = `SELECT name, price FROM ${stockTable} WHERE item_id = $1`;

      try {
        const stockResult = await db.query(stockQuery, [order.item_id]);

        allOrdersData.push({
          order_id: order.order_id,
          status: order.status,
          item: stockResult.rows[0] || { name: "Unknown", price: 0 },
        });
      } catch (error) {
        console.error(`Error fetching data from ${stockTable}:`, error);
      }
    }

    // Process orders for rendering
    const ordersMap = new Map();

    allOrdersData.forEach((row) => {
      if (!ordersMap.has(row.order_id)) {
        ordersMap.set(row.order_id, {
          order_id: row.order_id,
          status: row.status,
          items: [],
        });
      }

      const order = ordersMap.get(row.order_id);
      order.items.push({
        name: row.item.name,
        price: row.item.price,
      });
    });

    const allOrders = Array.from(ordersMap.values());
    const ongoingOrders = allOrders.filter(
      (order) => order.status !== "Delivered"
    );
    const completedOrders = allOrders.filter(
      (order) => order.status === "Delivered"
    );

    res.render("orders.ejs", {
      ordersDataOngoing: ongoingOrders,
      ordersDataDelivered: completedOrders,
    });
  } catch (error) {
    console.error("Error retrieving orders:", error);
    res.status(500).render("error", {
      message: "Internal server error",
      error: { status: 500, stack: error.stack },
    });
  }
});

app.get("/orderDetailsUser", authenticateUser, async (req, res) => {
  try {
    if (!req.user) {
      return res.redirect("/newLogin");
    }

    const orderId = req.query.order_id;
    const userEmail = req.user.Email;

    if (!orderId) {
      return res.status(400).send("Order ID is required");
    }

    // Fetch order details
    const orderData = await db.query(
      "SELECT * FROM orders WHERE order_id=$1 AND email=$2",
      [orderId, userEmail]
    );

    if (orderData.rows.length === 0) {
      return res.status(404).send("Order not found or does not belong to you");
    }

    // Fetch all item details **in parallel** to improve performance
    const itemDetailsPromises = orderData.rows.map((item) =>
      db
        .query(`SELECT * FROM stock_${item.item_type} WHERE item_id=$1`, [
          item.item_id,
        ])
        .then((result) => result.rows[0])
    );

    const itemDetails = await Promise.all(itemDetailsPromises);

    return res.render("orderDetailsUser.ejs", {
      order: orderData.rows,
      itemDetails: itemDetails,
    });
  } catch (error) {
    console.error("Error fetching order details:", error);
    return res.status(500).send("Internal Server Error");
  }
});

//yaha pe academy achievements ka hai
app.get("/achievements", async (req, res) => {
  try {
    // Query the database to get the achievements
    const { rows: achievementData } = await db.query(
      "SELECT * FROM achievements ORDER BY id ASC"
    );

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
    console.error(
      "Cannot retrieve achievements data from the database:",
      error.message
    );

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
          studentsAchievementsData: result,
        });
      } catch (error) {
        console.error("Error fetching achievements:", error);
        res.status(500).send("Internal Server Error");
      }
    } else {
      res.render("studentsAchievements.ejs", {
        studentsAchievementsData: null,
      });
    }
  } catch (error) {
    console.log("Error rendering students achievements page");
  }
});

app.get("/meetOurCoach", authenticateUser, async (req, res) => {
  if (req.user) {
    res.render("meetOurCoach.ejs");
  } else {
    res.render("meetOurCoach.ejs");
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
        studentDetails: studentAchievements,
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
app.use("/FAQ", authenticateUser, async (req, res) => {
  if (req.user) {
    try {
      const firstName = req.user.fullName.split(" ")[0];
      const { rows: FAQ_data } = await db.query("SELECT * FROM faq");
      res.render("FAQ.ejs", { FAQ_data: FAQ_data, Login: firstName });
    } catch (error) {
      console.log("Unable to fetch FAQ's data");
    }
  } else {
    const { rows: FAQ_data } = await db.query("SELECT * FROM faq");
    res.render("FAQ.ejs", { FAQ_data: FAQ_data, Login: null });
  }
});

//yaha pe newsletter ka hai
// app.post("/subscribedToNewsLetter", authenticateUser, async (req, res) => {
//     if (req.user) {
//       try {
//         const {Email} = req.body;
//         console.log(Email);
//         if (Email) {
//           const checkDuplicateEmail_forNewsLetter = await db.query(
//             "SELECT * FROM news_letter_subscriber WHERE email=$1",
//             [Email]
//           );
//           if (checkDuplicateEmail_forNewsLetter.rows.length>0) {
//             // res.render("/");
//             res.send("Email already exist");
//             console.log("Email already exist");
//           } else {
//             await db.query(
//               "INSERT INTO news_letter_subscriber(email) VALUES($1)",
//               [Email]
//             );
//             res.redirect("/");
//             console.log("Email successfully added for news letter");
//            }
//         }
//       } catch (error) {
//         res.redirect("/");
//         console.log("Failed to get email subscribe news letter route", error);
//       }
//     } else {
//       res.redirect("/newLogin");
//       console.log(
//         "User not logged in and trying to subscribe to newsLetter that is why redirected to login page"
//       );
//     }
// });

app.post("/subscribedToNewsLetter", authenticateUser, async (req, res) => {
  if (req.user) {
    try {
      const { Email } = req.body;
      // console.log(Email);
      if (Email) {
        const checkDuplicateEmail_forNewsLetter = await db.query(
          "SELECT * FROM news_letter_subscriber WHERE email=$1",
          [Email]
        );
        if (checkDuplicateEmail_forNewsLetter.rows.length > 0) {
          res.send("Email already exists");
          console.log("Email already exists");
        } else {
          await db.query(
            "INSERT INTO news_letter_subscriber(email) VALUES($1)",
            [Email]
          );
          res.send("Email successfully added for newsletter");
          console.log("Email successfully added for newsletter");
        }
      }
    } catch (error) {
      res.status(500).send("An error occurred");
      console.log("Failed to subscribe to newsletter route", error);
    }
  } else {
    // Send a JSON response for redirection when user is not logged in
    res.status(401).json({ redirectTo: "/newLogin" });
    console.log("User not logged in, redirecting to login page");
  }
});

//Admin panel funtionnality starts here
// Route for sending newsletters
app.get("/Create_newsLetter", authenticateUser, async (req, res) => {
  admin.createNewsLetterAdmin(req, res);
});
// yaha pe news letter bhejne ka hai for admin.
app.get("/adminDashboard", authenticateUser, (req, res) => {
  const firstName = req.user.fullName.split(" ")[0];
  admin.adminRole(req, res, firstName);
});
app.get("/updateAchievements", authenticateUser, (req, res) => {
  if (req.user) {
    res.render("Update_Achievements.ejs");
    console.log("Update achievements page opened");
  } else {
    res.redirect("/newLogin");
    console.log("Update achievements page not opened user not logged in");
  }
});

app.post("/NewsLetter_Sending", async (req, res) => {
  const { Title, Description } = req.body;

  // Set up the email transporter
  const transporter = nodemailer.createTransport({
    service: "gmail", // You can use other services like Outlook, SMTP, etc.
    auth: {
      user: process.env.nodeMailerEmailValidatorEmail, // Your email
      pass: process.env.nodeMailerEmailValidatorPass, // Your email password or app password
    },
  });

  // Function to send email to each subscriber
  const sendNewsletter = async (email) => {
    const mailOptions = {
      from: process.env.nodeMailerEmailValidatorEmail,
      to: email,
      subject: Title,
      text: Description,
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
    res.redirect("/adminDashboard?newsletterStatus=success");
  } catch (error) {
    console.error("Failed to send newsletter:", error);
    res.redirect("/adminDashboard?newsletterStatus=failure"); // Redirect with failure parameter
  }
});

// yaha pe images user se lena ka hai middleware.
const storage = multer.diskStorage({
  destination: path.join(_dirname, "public/images"),
  filename: function (req, file, cb) {
    const timestamp = Date.now();
    const fileExt = path.extname(file.originalname);
    const filename = `${timestamp}-${file.originalname}`;
    cb(null, filename);
  },
});

const upload = multer({ storage: storage });

//specialized middleware for multiple images
const uploadMultiple = upload.fields([
  { name: 'itemsImage', maxCount: 1 },
  { name: 'itemsImage1', maxCount: 1 },
  { name: 'itemsImage2', maxCount: 1 }
]);

// Define your route with multer middleware
app.post("/AddAchievements",authenticateUser,upload.single("imageTaken"),
  async (req, res) => {
    const { placeName, medalsWon, description } = req.body;
    const imageTaken = req.file;

    // Check if user is authenticated
    if (!req.user) {
      console.error("Unauthorized access: req.user is undefined");
      return res.status(401).send("Unauthorized");
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
        console.log("Achievement successfully added to the database.");

        // Retrieve all achievements from the database after adding the new one
        const { rows: achievementData } = await db.query(
          "SELECT * FROM achievements ORDER BY id DESC"
        );

        if (achievementData.length > 0) {
          console.log("Rendering achievements.ejs with data:", achievementData);
          // Render the achievements page with the retrieved data
          res.render("achievements.ejs", {
            toastForNewsLetter: false,
            achievementData: achievementData,
          });
        } else {
          console.log("No achievements data found.");
          // Render the page with an empty achievements array if none found
          res.render("achievements.ejs", {
            achievementData: [],
            toastForNewsLetter: true,
          });
        }
      } else {
        console.error("Failed to add the achievement.");
        res.status(500).send("Failed to add achievements.");
      }
    } catch (error) {
      console.error(
        "Error inserting or retrieving achievements from the database:",
        error.message
      );
      res.status(500).send("Failed to retrieve or add achievements.");
    }
  }
);

app.get("/downloadOnlineUserData", async (req, res) => {
  const data = await db.query("SELECT * FROM users");
  const users = data.rows;
  console.log(users);
  admin.downloadOnlineUsersList(req, res, users);
});
app.get("/downloadofflineUserData", async (req, res) => {
  const data = await db.query("SELECT * FROM offline_customer");
  const users = data.rows;
  console.log(users);
  admin.downloadOfflineUsersList(req, res, users);
});
app.get("/downloadavailableStock", async (req, res) => {
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
  // console.log(totalStock);
  admin.downloadavailableStock(req, res, totalStock);
});
app.get("/downloadOnlineSaleList", async (req, res) => {
  try {
    const data = await db.query(
      "SELECT * FROM orders WHERE status=$1 ORDER BY created_at DESC",
      ["Delivered"]
    );
    const ordersOnline = data.rows;
    console.log(ordersOnline);
    admin.downloadOnlineSaleList(req, res, ordersOnline);
  } catch (error) {
    console.error("Error fetching online sale list:", error);
    res.status(500).send("Error fetching online sale list");
  }
});
app.get("/registerNewStudent", authenticateUser, async (req, res) => {
  if (req.user) {
    res.render("NewStudentRegistration.ejs", {
      toastMessage: false,
    });
  }
});
app.post("/addStudent", authenticateUser, async (req, res) => {
  const {
    Student_Name,
    Father_name,
    Mother_name,
    mobile_number,
    email,
    groupAddedOn,
    skate_type,
    feePaid,
    feeStructure,
  } = req.body;
  try {
    try {
      if (
        Student_Name &&
        Father_name &&
        Mother_name &&
        mobile_number &&
        email &&
        groupAddedOn &&
        skate_type &&
        feePaid &&
        feeStructure
      ) {
        // Check if the student already exists
        const result = await db.query(
          "SELECT * FROM students WHERE student_name=$1 AND father_name=$2 AND mother_name=$3",
          [Student_Name, Father_name, Mother_name]
        );

        if (result.rows.length > 0) {
          console.log("Student already exists in the database");
          res.render("NewStudentRegistration.ejs", { toastMessage: true });
          // return 'e'; // Student exists
        } else {
          // Insert new student
          const response = await db.query(
            "INSERT INTO students (student_name, father_name, mother_name, mobile_number, email, groupAddedOn, skate_type, feePaid,feeStructure) VALUES ($1, $2, $3, $4, $5, $6, $7, $8,$9)",
            [
              Student_Name,
              Father_name,
              Mother_name,
              mobile_number,
              email,
              groupAddedOn,
              skate_type,
              feePaid,
              feeStructure,
            ]
          );

          //date is set to default current date and will be set automatically so no need to pass it.

          if (response.rowCount > 0) {
            console.log("Student registered and details added to the database");
            res.render("NewStudentRegistration.ejs", { toastMessage: true });
          } else {
            console.log(
              "Student not registered and details not added to the database"
            );
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
app.get("/markingAttendance", authenticateUser, async (req, res) => {
  if (req.user) {
    const stud_data = await db.query("Select * from students");
    // console.log(stud_data);
    res.render("Attendance_Page.ejs", {
      stud_data: stud_data.rows, //sending the data of students to the client side from here
      toast: false,
    });
  } else {
    res.render("login.ejs");
  }
});
app.post("/confirmAttendance", async (req, res) => {
  const attendanceData = req.body; // This should contain attendance_<student_id>
  console.log("Received Attendance Data:", attendanceData); // Check the structure

  try {
    for (const key in attendanceData) {
      // Extract the student ID from the key
      const studentId = key.split("_")[1]; // Get the ID from the key

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
        console.log(
          `Attendance already recorded for student ${studentId} on this date.`
        );
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
    console.error("Error inserting attendance data:", error);
    res.redirect("/markingAttendance");
  }
});
app.get("/monthlyAttendance", authenticateUser, async (req, res) => {
  try {
    if (req.user) {
      const data = await db.query(
        "Select stud_id,student_name,mother_name from students"
      );
      const attendance_data = data.rows;
      res.render("monthlyAttendance.ejs", {
        attendance_data: attendance_data,
      });
    }
  } catch (error) {
    res.render("login.ejs");
  }
});
app.post("/studentAttendanceDetails", authenticateUser, async (req, res) => {
  try {
    if (req.user) {
      const { student_id_entered, SelectedMonth } = req.body;

      // Corrected query with filtering by student_id_entered
      const studentData = await db.query(
        `
          SELECT s.stud_id, s.student_name, s.mother_name, a.attendance_date, a.status 
          FROM attendance a 
          JOIN students s ON s.stud_id = a.student_id 
          WHERE s.stud_id = $1 AND EXTRACT(MONTH FROM a.attendance_date) = $2
        `,
        [student_id_entered, SelectedMonth]
      );

      await admin.attendanceDetails(req, res, studentData.rows);
    } else {
      res.render("login.js");
    }
  } catch (error) {
    console.error("Error processing attendance details:", error);
    res.status(500).send("Internal Server Error");
  }
});
// Attendance part ends from Here.
app.get("/downloadOfflineSaleList", async (req, res) => {
  try {
    const data = await db.query(
      "SELECT * FROM orders_offline ORDER BY created_at DESC"
    );
    const ordersOffline = data.rows;
    console.log(ordersOffline);
    admin.downloadOfflineSaleList(req, res, ordersOffline);
  } catch (error) {
    console.error("Error fetching online sale list:", error);
    res.status(500).send("Error fetching online sale list");
  }
});
app.get("/editHomePage", authenticateUser, (req, res) => {
  if (req.user) {
    res.render("edit_Home.ejs");
  }
});
// yaha pe shop ke edit karne ka hai.
app.get("/editShop", authenticateUser, async (req, res) => {
  try {
    const firstName = req.user.fullName.split(" ")[0];
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
      items_data: totalStock,
      Login: firstName,
      toastForNewsLetter: false,
    });
  } catch (error) {
    console.log("Cannot get items data for Edit shop page");
  }
});
app.get("/updateItemForShop", authenticateUser, async (req, res) => {
  try {
    const { item_id, item_type } = req.query; // Assuming item_id and item_type are passed as query parameters
    // console.log(item_id,item_type);
    const data = await db.query(
      `SELECT * FROM stock_${item_type} WHERE item_id=$1`,
      [item_id]
    );
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
  const client = await db.connect();
  
  try {
    if (!req.user) {
      return res.status(403).send("Unauthorized access");
    }

    const { item_id, item_type } = req.body;

    // Start transaction
    await client.query('BEGIN');

    // First check if item exists
    const data = await client.query(
      `SELECT * FROM stock_${item_type} WHERE item_id=$1`,
      [item_id]
    );
    const result = data.rows[0];

    if (!result) {
      await client.query('ROLLBACK');
      console.log("Item does not exist for deletion");
      return res.status(404).send("Item not found");
    }

    // Delete in specific order to maintain referential integrity
    // 1. First delete from product_details (child table)
    await client.query(
      `DELETE FROM product_details WHERE item_id=$1`,
      [item_id]
    );
    console.log("Deleted from product_details table");

    // 2. Delete from stock_[type] table
    await client.query(
      `DELETE FROM stock_${item_type} WHERE item_id=$1`,
      [item_id]
    );
    console.log(`Deleted from stock_${item_type} table`);

    // 3. Finally delete from stocks table (parent table)
    await client.query(
      `DELETE FROM stocks WHERE item_id=$1 AND item_type=$2`,
      [item_id, item_type]
    );
    console.log("Deleted from stocks table");

    // Commit transaction
    await client.query('COMMIT');
    console.log("Item deleted successfully from all tables");

    res.redirect("/editShop");

  } catch (error) {
    // Rollback transaction in case of any error
    await client.query('ROLLBACK');
    console.error("Error deleting item:", error);
    res.status(500).send("Internal server error");
  } finally {
    // Release the client back to the pool
    client.release();
  }
});

app.post("/updateItemForShop", authenticateUser, async (req, res) => {
  try {
    if (req.user) {
      const { item_id, item_type } = req.body;

      const data = await db.query(
        `SELECT * FROM stock_${item_type} WHERE item_id=$1`,
        [item_id]
      );
      const result = data.rows[0];

      if (!result) {
        return res
          .status(404)
          .json({ success: false, message: "Item not found" });
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
app.get("/addNewItem", authenticateUser, (req, res) => {
  if (req.user) {
    res.render("add_itemPage.ejs");
    console.log("Add item page rendered successfully");
  } else {
    res.redirect("/newLogin");
    console.log("Add item page cannot be rendered admin not logged in");
  }
});

app.post("/completeAddingNewItem", authenticateUser, uploadMultiple, async (req, res) => {
  const client = await db.connect();  
  try {
    await client.query('BEGIN');

    // Check if all required files are present
    if (!req.files || !req.files.itemsImage || !req.files.itemsImage1 || !req.files.itemsImage2) {
      throw new Error('All three images are required');
    }

    // Get the uploaded files
    const itemsImage = req.files.itemsImage[0];
    const itemsImage1 = req.files.itemsImage1[0];
    const itemsImage2 = req.files.itemsImage2[0];

    // Extract data from request body
    const { 
      itemsName, 
      itemsDescription, 
      itemsItemId, 
      itemsPrice, 
      itemsItemType,
      color 
    } = req.body;

    const sizes = req.body.sizes;
    const quantities = req.body.quantities;

    // Validate sizes and quantities
    if (!sizes || !quantities || sizes.length !== quantities.length) {
      throw new Error('Invalid size and quantity data');
    }

    // Build image paths
    const imagePath = `/images/${itemsImage.filename}`;
    const imagePath1 = `/images/${itemsImage1.filename}`;
    const imagePath2 = `/images/${itemsImage2.filename}`;

    // Generate a unique item_type_id
    const item_type_id = `${itemsItemType.substring(0, 3)}${Date.now()}`;

    // Calculate total quantity
    const totalQuantity = quantities.reduce((sum, qty) => sum + parseInt(qty), 0);

    // 1. First, insert into stocks table
    await client.query(
      `INSERT INTO stocks (item_type, item_id, item_type_id) 
       VALUES ($1, $2, $3)`,
      [itemsItemType, itemsItemId, item_type_id]
    );
    console.log("Item added to stocks table");

    // 2. Then, insert into stock_[type] table
    await client.query(
      `INSERT INTO stock_${itemsItemType} 
       (img, name, description, item_id, price, quantity, item_type, item_type_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        imagePath,  // Using the first image as the main image
        itemsName,
        itemsDescription,
        itemsItemId,
        itemsPrice,
        totalQuantity,
        itemsItemType,
        item_type_id
      ]
    );
    console.log(`Item added to stock_${itemsItemType} table`);

    // 3. Insert product details - one entry per size with all images
    for (let i = 0; i < sizes.length; i++) {
      if (sizes[i] && quantities[i]) {
        await client.query(
          `INSERT INTO product_details (img, img1, img2, item_id, color, size, quantity)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [imagePath, imagePath1, imagePath2, itemsItemId, color, sizes[i], quantities[i]]
        );
      }
    }
    console.log("Size details and images added to product_details table");

    await client.query('COMMIT');
    console.log("All insertions completed successfully");

    res.redirect("/editShop");

  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error adding new item:", error);
    res.status(500).send(`Error adding item: ${error.message}`);
  } finally {
    client.release();
  }
});

app.post("/completeUpdationOfItem", authenticateUser, async (req, res) => {
  try {
    const {
      item_id,
      item_type,
      Change_itemName,
      ChangeItemDescription,
      addQuantity,
      ChangeItemPrice,
    } = req.body;

    if (req.user) {
      console.log("Form data received:", req.body); // Logging the form data
      const firstName = req.user.fullName.split(" ")[0];
      try {
        const data = await db.query(
          `SELECT * FROM stock_${item_type} WHERE item_id=$1`,
          [item_id]
        );
        const currentItem = data.rows[0];

        if (!currentItem) {
          throw new Error("Item not found");
        }

        const newName =
          Change_itemName && Change_itemName !== currentItem.name
            ? Change_itemName
            : currentItem.name;
        const newDescription =
          ChangeItemDescription &&
          ChangeItemDescription !== currentItem.description
            ? ChangeItemDescription
            : currentItem.description;
        const newPrice =
          ChangeItemPrice && ChangeItemPrice !== currentItem.price
            ? ChangeItemPrice
            : currentItem.price;
        const newAddedQuantity = addQuantity
          ? currentItem.quantity + parseInt(addQuantity, 10)
          : currentItem.quantity;

        await db.query(
          `UPDATE stock_${item_type} SET name=$1, description=$2, quantity=$3, price=$4 WHERE item_id=$5`,
          [newName, newDescription, newAddedQuantity, newPrice, item_id]
        );

        console.log("Update successful"); // Logging success

        const dataSkate = await db.query("SELECT * FROM stock_skates");
        const dataHelmets = await db.query("SELECT * FROM stock_helmets");
        const dataWheels = await db.query("SELECT * FROM stock_wheels");
        const dataSkinSuits = await db.query("SELECT * FROM stock_skinsuits");
        const dataAccessories = await db.query(
          "SELECT * FROM stock_accessories"
        );

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
          Login: firstName,
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

app.get("/ordersStatus", authenticateUser, async (req, res) => {
  const data = await db.query("SELECT * FROM orders");
  const result = data.rows;
  if (req.user) {
    res.render("orders_status.ejs", {
      Order_data: result,
    });
  } else {
    res.render("login.ejs");
  }
});

app.post("/orderDetails", authenticateUser, async (req, res) => {
  const { getOrderDetails } = req.body;
  if (req.user) {
    const data = await db.query("SELECT * FROM orders WHERE order_id=$1", [
      getOrderDetails,
    ]);
    const result = data.rows[0];
    if (result) {
      res.render("orderDetails.ejs", {
        order_data: result,
        toastForNewsLetter: false,
      });
    } else {
      res.render("orderDetails.ejs", {
        order_data: null,
        toastForNewsLetter: false,
      });
    }
  }
});
app.post("/changeStatus", authenticateUser, (req, res) => {
  const newStatus = req.body.orderStatusChange;
  const orderId = req.body.orderId;
  if (req.user) {
    admin.changeOrderStatus(req, res, newStatus, orderId);
    console.log("User is verified hence calling change status function");
  } else {
    res.render("login.ejs");
  }
});
app.post("/downloadOrderDetails", authenticateUser, async (req, res) => {
  try {
    if (req.user) {
      const orderId = req.body.orderId;
      const data = await db.query("SELECT * FROM orders WHERE order_id=$1", [
        orderId,
      ]);
      const order_data = data.rows[0];
      if (order_data) {
        admin.getOrderDetails(req, res, order_data);
      } else {
        console.log("Could not get order it does not exist ");
      }
    } else {
      res.render("login.js");
    }
  } catch (error) {
    console.log("could not download oreder details", error);
  }
});
app.post("/editAchievementsText", authenticateUser, async (req, res) => {
  try {
    const userDetails = await db.query("SELECT * FROM users WHERE email = $1", [
      req.user.Email,
    ]);
    const userCheck = userDetails.rows[0];
    const firstName = userCheck.full_name.split(" ")[0];
    const { editTextForAchievements } = req.body;

    if (req.user) {
      await admin.editAchievementsText(
        req,
        res,
        editTextForAchievements,
        firstName
      );
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
    const userDetails = await db.query("SELECT * FROM users WHERE email = $1", [
      req.user.Email,
    ]);
    const userCheck = userDetails.rows[0];
    const firstName = userCheck.full_name.split(" ")[0];
    const { editTextForMeetOurCoach } = req.body;

    if (req.user) {
      await admin.editMeetOurCoachText(
        req,
        res,
        editTextForMeetOurCoach,
        firstName
      );
    } else {
      res.redirect("/login"); // Redirect to login if user is not authenticated
    }
  } catch (error) {
    console.log("Error fetching user details", error);
    res.status(500).send("Internal Server Error");
  }
});

// yaha pe invoice ka hai.
app.get("/createInvoice", authenticateUser, async (req, res) => {
  try {
    const itemsData = [
      "skates",
      "helmets",
      "wheels",
      "skinsuits",
      "accessories",
    ];
    const allItemsData = {};
    if (req.user) {
      for (var i = 0; i < itemsData.length; i++) {
        const result = await db.query(
          `SELECT * FROM stock_${itemsData[i]} WHERE quantity >= 1`
        );
        allItemsData[itemsData[i]] = result.rows; //yaha pe key value pair ban raha hai where items name is the key and result.rows is values to those key
      }
      res.render("generate_invoice.ejs", {
        item_data: allItemsData,
      });
      console.log("generate invoice page opened sucessfully");
    }
  } catch (error) {
    res.render("login.ejs");
    console.log("cannot open invoice page", error);
  }
});
app.post("/generateInvoice", authenticateUser, async (req, res) => {
  try {
    const { customer_name, customer_email, customer_number } = req.body;
    const { items } = req.body; //here items is like the array of objects
    // console.log(items);
    if (req.user) {
      const offlineCustomerCheck = await db.query(
        "SELECT * FROM offline_customer WHERE email=$1 AND mobile_number=$2",
        [customer_email, customer_number]
      );
      if (offlineCustomerCheck.rows.length === 0) {
        await db.query(
          "INSERT INTO offline_customer (full_name,email,mobile_number) VALUES($1,$2,$3)",
          [customer_name, customer_email, customer_number]
        );
        console.log(
          "Successfully added offline customer details in the database"
        );
        const customer_details = await db.query(
          "SELECT * FROM offline_customer WHERE email=$1 OR mobile_number=$2",
          [customer_email, customer_number]
        );
        const customer_data = customer_details.rows[0];
        admin.invoiceGeneration(req, res, customer_data, items);
      } else {
        const customer_details = await db.query(
          "SELECT * FROM offline_customer WHERE email=$1 OR mobile_number=$2",
          [customer_email, customer_number]
        );
        // console.log("Offline Customer already exist");
        const customer_data = customer_details.rows[0];
        admin.invoiceGeneration(req, res, customer_data, items);
      }
    } else {
      res.render("login.ejs");
    }
  } catch (error) {
    console.log("cannot get offline customer details", error);
  }
});
app.post("/generateBill", authenticateUser, async (req, res) => {
  try {
    const { customer_name, customer_email, customer_number } = req.body;
    const { items } = req.body; //here items is like the array of objects
    // console.log(items);
    if (req.user) {
      const offlineCustomerCheck = await db.query(
        "SELECT * FROM offline_customer WHERE email=$1 AND mobile_number=$2",
        [customer_email, customer_number]
      );
      if (offlineCustomerCheck.rows.length === 0) {
        await db.query(
          "INSERT INTO offline_customer (full_name,email,mobile_number) VALUES($1,$2,$3)",
          [customer_name, customer_email, customer_number]
        );
        console.log(
          "Successfully added offline customer details in the database"
        );
        const customer_details = await db.query(
          "SELECT * FROM offline_customer WHERE email=$1 OR mobile_number=$2",
          [customer_email, customer_number]
        );
        const customer_data = customer_details.rows[0];
        const billGenerationComplete = admin.billGeneration(
          req,
          res,
          customer_data,
          items
        );
        if (billGenerationComplete) {
          for (const item of items) {
            await db.query(
              "INSERT INTO orders_offline (email, name, mobile_number, item_name, item_id, item_type, amount, quantity) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
              [
                customer_email,
                customer_name,
                customer_number,
                item.item_name,
                item.item_id,
                item.item_type,
                item.price,
                "1",
              ]
            );
            await db.query(
              `UPDATE stock_${item.item_type} SET quantity = quantity - $1 WHERE item_id = $2`,
              [1, item.item_id]
            );
          }
          console.log("quantity updated through offline purchase");
          console.log("offline purchase complete adding details to database");
        }
      } else {
        const customer_details = await db.query(
          "SELECT * FROM offline_customer WHERE email=$1 OR mobile_number=$2",
          [customer_email, customer_number]
        );
        // console.log("Offline Customer already exist");
        const customer_data = customer_details.rows[0];
        admin.billGeneration(req, res, customer_data, items);
        const billGenerationComplete = admin.billGeneration(
          req,
          res,
          customer_data,
          items
        );
        if (billGenerationComplete) {
          for (const item of items) {
            await db.query(
              "INSERT INTO orders_offline (email, name, mobile_number, item_name, item_id, item_type, amount, quantity) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
              [
                customer_email,
                customer_name,
                customer_number,
                item.item_name,
                item.item_id,
                item.item_type,
                item.price,
                "1",
              ]
            );
            await db.query(
              `UPDATE stock_${item.item_type} SET quantity = quantity - $1 WHERE item_id = $2`,
              [1, item.item_id]
            );
          }
        }
      }
    } else {
      res.render("login.ejs");
    }
  } catch (error) {
    console.log("cannot get offline customer details", error);
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
