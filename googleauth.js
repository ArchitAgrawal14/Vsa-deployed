// import { OAuth2Client } from "google-auth-library";
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth2';
import dotenv from 'dotenv';
dotenv.config();

passport.use(new GoogleStrategy({
    clientID:process.env.googleClientId,
    clientSecret: process.env.googleSecretKey,
    callbackURL: "http://localhost:3000/auth/google/callback",
    passReqToCallback   : true
  },
  function(request, accessToken, refreshToken, profile, done) {
    done(null,profile);
  }
));
passport.serializeUser((user,done)=>
{
    done(null,user)
});
passport.deserializeUser((user,done)=>{
    done(null,user);
})
// const Client=new OAuth2Client('910276421704-6f790lrdsfnsj5sk7m1og744bfofkuu6.apps.googleusercontent.com');
// app.post("")
