const mongoose = require('mongoose');

const cartaoSchema = new mongoose.Schema({
  CPF: { type: String, required: true }, 
  numeroCartao: { type: String, required: true },
  nomeCartao: { type: String, required: true },
  validadeMes: { type: String, required: true },
  validadeAno: { type: String, required: true },
  codigoSeguranca: { type: String, required: true },
});

module.exports = mongoose.model('Cartao', cartaoSchema);
