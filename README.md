<div align="center">

# OmniGravity

### Drop-in AI Chat for Google Antigravity IDE with DeepSeek, NVIDIA NIM & Local Models

<p align="center">
  <em>Continue coding with open models (DeepSeek R1, Nemotron, Llama 3.3, Ollama) directly inside your Antigravity IDE.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.1-3186FF?style=flat-square" alt="Version" />
  <img src="https://img.shields.io/badge/Antigravity%20IDE-Compatible-00B95C?style=flat-square" alt="Antigravity Compatible" />
  <img src="https://img.shields.io/badge/NVIDIA%20NIM-Supported-76B900?style=flat-square&logo=nvidia" alt="NVIDIA NIM" />
  <img src="https://img.shields.io/badge/DeepSeek%20R1-Reasoning-8A2BE2?style=flat-square" alt="DeepSeek R1" />
  <img src="https://img.shields.io/badge/Local%20Models-Ollama%20%7C%20LM%20Studio-FBBC04?style=flat-square" alt="Local Models" />
  <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License" />
</p>

</div>

<br/>

> [!IMPORTANT]
> **100% Client-Side & Private**: OmniGravity runs completely inside your local Antigravity IDE. Your NVIDIA API keys and conversation databases stay strictly on your local machine.

---

## ⚡ Simple 2-Step Installation

### Step 1: Download VSIX
Download the latest pre-built extension:
👉 **[Download omnigravity-1.0.1.vsix](https://github.com/sauravkumeriya/omnigravity/releases/latest/download/omnigravity-1.0.1.vsix)**

### Step 2: Install in Antigravity IDE
1. Open Antigravity IDE.
2. Press **`Ctrl + Shift + P`** (or `F1`).
3. Type **`Extensions: Install from VSIX...`** and hit Enter.
4. Select the downloaded `omnigravity-1.0.1.vsix`.
5. Click **Reload Window** if prompted. The **OmniGravity** icon will appear on your left sidebar!

*(Alternatively, run in terminal: `antigravity-ide --install-extension omnigravity-1.0.1.vsix`)*

---

## 🔑 Setup Your API Key

1. Get a free API key from [build.nvidia.com](https://build.nvidia.com/).
2. In Antigravity IDE, click the **OmniGravity** sidebar icon.
3. Click the model pill at the bottom (`Nemotron 3 Ultra ^`).
4. Click **Set NVIDIA API Key** and paste your `nvapi-...` key.

---

## 🤖 Supported Models

OmniGravity includes curated presets and **automatically fetches all 80+ live models** from your NVIDIA NIM account:

| Model | Tag | Description |
|---|---|---|
| `deepseek-ai/deepseek-r1` | `Reasoning` | Step-by-step reasoning & math with collapsible `<think>` block |
| `nvidia/nemotron-3-ultra-550b-a55b` | `Flagship` | NVIDIA flagship model for architecture & deep reasoning |
| `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning` | `Thinking` | Fast reasoning model |
| `nvidia/llama-3.1-nemotron-70b-instruct` | `70B` | Tuned 70B model for general development |
| `meta/llama-3.3-70b-instruct` | `General` | Open weight standard for coding and explanation |
| `mistralai/mistral-large-2407` | `Coding` | High-precision coding and refactoring |
| `thudm/glm-5.3-flash` | `Fast` | Lightweight fast responses |
| `moonshotai/kimi-k3.1-pro` | `128k` | Long context window |
| `qwen/qwen2.5-72b-instruct` | `Coding` | Code generation and debugging |
| `Ollama (Llama 3)` | `Local` | Offline local models running on `localhost:11434` |
| `LM Studio` | `Local` | Offline local models running on `localhost:1234` |
| **All Other NIM Models** | `NIM` | **Auto-fetched dynamically** — search or type any model ID |

---

## ✨ Features

* **Antigravity Look & Feel**: Native theme integration with dark gray styling and official glowing Antigravity logo.
* **Collapsible Thought Process**: Chain-of-thought tokens from DeepSeek R1 are automatically displayed in clean collapsible accordion blocks.
* **Code Actions**: Fenced code blocks feature 1-click **Create File** (saves directly into your workspace) and **Copy**.
* **Import Antigravity Sessions**: Browse and import past Antigravity conversations from local SQLite storage to continue chatting.
* **Local LLM Support**: Switch to local Ollama or LM Studio models anytime for 100% offline development.

---

## ⚙️ Configuration Reference

You can customize settings in Antigravity IDE (`Ctrl+,` -> search `OmniGravity`):

| Setting | Default | Description |
|---|---|---|
| `antigravity-nvidia-chat.apiKey` | `""` | NVIDIA NIM API key (`nvapi-...`) |
| `antigravity-nvidia-chat.defaultModel` | `nvidia/nemotron-3-ultra-550b-a55b` | Default model on launch |
| `antigravity-nvidia-chat.ollamaUrl` | `http://localhost:11434` | Ollama URL |
| `antigravity-nvidia-chat.lmstudioUrl` | `http://localhost:1234` | LM Studio URL |
| `antigravity-nvidia-chat.maxTokens` | `8192` | Maximum output tokens |
| `antigravity-nvidia-chat.temperature` | `0.7` | Temperature for generation |

---

## 📄 License

MIT License
