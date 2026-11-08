import AsyncStorage from "@react-native-async-storage/async-storage";

export type SupportedLanguage = "pt-BR" | "en-US";

export const LANGUAGE_STORAGE_KEY = "@privadin:language";

export const translations = {
  "pt-BR": {
    badge: "Competição Corporativa",
    title: "PrivadIn",
    subtitle: "O app definitivo da cagada remunerada",
    featureRealtime: "Tempo Real",
    featureRealtimeSub: "Ganhos por segundo",
    featureRanking: "Ranking",
    featureRankingSub: "Dispute a liderança",
    featureAntifraud: "Antifraude",
    featureAntifraudSub: "cooldown",
    tabSignIn: "Entrar",
    tabRegister: "Cadastrar",
    labelName: "Nome ou Apelido",
    placeholderName: "Ex: Mestre do Trono",
    labelEmail: "E-mail",
    placeholderEmail: "seu@empresa.com",
    labelPassword: "Senha",
    placeholderPassword: "••••••••",
    forgotPassword: "Esqueceu ou deseja alterar a senha?",
    labelGroupCode: "Código da liga/grupo",
    badgeOptional: "Opcional",
    placeholderGroupCode: "Ex: ABCD1234",
    groupCodeHint: "Se você recebeu um código da sua equipe, você já entra nela ao criar a conta.",
    btnSignIn: "Acessar o Trono",
    btnRegister: "Criar Conta e Começar",
    termsLabel: "Li e concordo com os",
    termsLink: "Termos de Uso",
    footerSecurity: "🔒 Seus dados e cagadas permanecem confidenciais.",
    errFillFields: "Preencha seu e-mail e sua senha.",
    errNameRequired: "Informe seu nome ou apelido para o cadastro.",
    errNameMin: "O apelido deve conter no mínimo 3 caracteres.",
    errNameMax: "O apelido deve conter no máximo 30 caracteres.",
    errEmailInvalid: "Formato de e-mail inválido.",
    errPasswordMin: "A senha deve conter no mínimo 6 caracteres.",
    errMustAcceptTerms: "Você deve aceitar os Termos de Uso vigentes para se cadastrar.",
    errWrongCredentials: "E-mail ou senha incorretos.",
    errEmailInUse: "Este e-mail já está cadastrado. Mude para a aba 'Entrar'.",
    errUserNotFound: "Nenhuma conta encontrada com este e-mail.",
    errWeakPassword: "A senha escolhida é muito fraca. Use ao menos 6 caracteres.",
    errTooManyRequests: "Muitas tentativas sem sucesso. Aguarde alguns instantes.",
  },
  "en-US": {
    badge: "Corporate Competition",
    title: "PrivadIn",
    subtitle: "The ultimate paid bathroom break app",
    featureRealtime: "Real-Time",
    featureRealtimeSub: "Earnings per second",
    featureRanking: "Leaderboard",
    featureRankingSub: "Compete for #1",
    featureAntifraud: "Anti-Fraud",
    featureAntifraudSub: "cooldown",
    tabSignIn: "Sign In",
    tabRegister: "Register",
    labelName: "Name or Nickname",
    placeholderName: "e.g.: Throne Master",
    labelEmail: "Email",
    placeholderEmail: "you@company.com",
    labelPassword: "Password",
    placeholderPassword: "••••••••",
    forgotPassword: "Forgot or want to change password?",
    labelGroupCode: "League/Group Code",
    badgeOptional: "Optional",
    placeholderGroupCode: "e.g.: ABCD1234",
    groupCodeHint: "If you received a code from your team, you'll join it automatically upon creating your account.",
    btnSignIn: "Access the Throne",
    btnRegister: "Create Account & Start",
    termsLabel: "I have read and agree to the",
    termsLink: "Terms of Use",
    footerSecurity: "🔒 Your data and logs remain strictly confidential.",
    errFillFields: "Please fill in your email and password.",
    errNameRequired: "Please provide your name or nickname.",
    errNameMin: "Nickname must be at least 3 characters long.",
    errNameMax: "Nickname cannot exceed 30 characters.",
    errEmailInvalid: "Invalid email format.",
    errPasswordMin: "Password must be at least 6 characters long.",
    errMustAcceptTerms: "You must accept the current Terms of Use to register.",
    errWrongCredentials: "Incorrect email or password.",
    errEmailInUse: "This email is already registered. Please switch to Sign In.",
    errUserNotFound: "No account found with this email.",
    errWeakPassword: "Password is too weak. Please use at least 6 characters.",
    errTooManyRequests: "Too many attempts. Please try again in a few moments.",
  },
};

export async function getPersistedLanguage(): Promise<SupportedLanguage> {
  try {
    const saved = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved === "en-US" || saved === "pt-BR") {
      return saved;
    }
  } catch (err) {
    console.warn("Error reading language preference:", err);
  }
  return "pt-BR";
}

export async function persistLanguage(lang: SupportedLanguage): Promise<void> {
  try {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  } catch (err) {
    console.warn("Error persisting language preference:", err);
  }
}
