import express from 'express'
import bodyParser from 'body-parser'
import helmet from 'helmet'
import QRCode from 'qrcode'
import BrCode from './lib/br_code.js';

const app = express();

app.use(helmet());
app.use(bodyParser.json());
app.set('view engine', 'handlebars');

const port = process.env.PORT || 8000;
const QR_CODE_SIZE = 400;

app.post('/emvqr-static', (req, res) => {
  var { key, amount, name, reference, key_type, city } = req.body

  if (key) {
      var brCode = new BrCode(key, amount, name, reference, key_type, city);

      var code = brCode.generate_qrcp()

      QRCode.toDataURL(code, {width: QR_CODE_SIZE, height: QR_CODE_SIZE})
      .then(qrcode => {
        res.json({
          qrcode_base64: qrcode,
          code: code,
          key_type: brCode.key_type,
          key: brCode.key,
          amount: brCode.amount,
          name: brCode.name,
          city: brCode.city,
          reference: brCode.reference,
          formated_amount: brCode.formated_amount()})
      })
      .catch(err => {
        console.error(err)
      })
  }
  else {
    res.status(422);
    res.json({ error: "Campo Key não presente"});
  }
});

app.listen(port, () => {
  console.log(`Starting generate pix server on port ${port}!`)
});
