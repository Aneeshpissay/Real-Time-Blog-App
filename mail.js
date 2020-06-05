const nodemailer = require('nodemailer');
var ur = process.env.GMAILUR;
var pw = process.env.GMAILPW;
const transport = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: ur,
    pass: pw
  },
});

module.exports = {
  sendEmail(from, to, subject, html) {
    return new Promise((resolve, reject) => {
      transport.sendMail({ from, subject, to, html }, (err, info) => {
        if (err) reject(err);
        resolve(info);
      });
    });
  }
}