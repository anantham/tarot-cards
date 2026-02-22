import type { Settings } from '../../types';

type GenerationSettingsSectionProps = {
  settings: Settings;
  showCardInfo: boolean;
  navWithArrows: boolean;
  updateSettings: (patch: Partial<Settings>) => void;
};

export function GenerationSettingsSection({
  settings,
  showCardInfo,
  navWithArrows,
  updateSettings,
}: GenerationSettingsSectionProps) {
  return (
    <section>
      <h3 style={{ fontSize: '1.3rem', marginBottom: '1rem', color: '#d4af37' }}>
        Generation Settings
      </h3>

      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', opacity: 0.9 }}>
          API Provider
        </label>
        <select
          value={settings.apiProvider || 'gemini'}
          onChange={(e) => updateSettings({ apiProvider: e.target.value as 'openrouter' | 'gemini' })}
          style={{
            width: '100%',
            padding: '0.75rem',
            background: 'rgba(0, 0, 0, 0.3)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '8px',
            color: '#e8e8e8',
            fontSize: '0.95rem',
            cursor: 'pointer',
          }}
        >
          <option value="gemini">Gemini Direct (Supports img2img with your photo!)</option>
          <option value="openrouter">OpenRouter (Text-to-image only)</option>
        </select>
        <p style={{ fontSize: '0.8rem', marginTop: '0.5rem', opacity: 0.6 }}>
          Gemini Direct allows using your photo as reference for tarot cards
        </p>
      </div>

      {settings.apiProvider === 'gemini' && (
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', opacity: 0.9 }}>
            Gemini API Key
          </label>
          <input
            type="password"
            value={settings.geminiApiKey || ''}
            onChange={(e) => updateSettings({ geminiApiKey: e.target.value })}
            placeholder="AIza..."
            style={{
              width: '100%',
              padding: '0.75rem',
              background: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              color: '#e8e8e8',
              fontSize: '0.95rem',
            }}
          />
          <p style={{ fontSize: '0.8rem', marginTop: '0.5rem', opacity: 0.6 }}>
            Get your API key from{' '}
            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" style={{ color: '#9333ea' }}>
              Google AI Studio
            </a>
          </p>
        </div>
      )}

      {settings.apiProvider === 'openrouter' && (
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', opacity: 0.9 }}>
            OpenRouter API Key
          </label>
          <input
            type="password"
            value={settings.apiKey || ''}
            onChange={(e) => updateSettings({ apiKey: e.target.value })}
            placeholder="sk-or-v1-..."
            style={{
              width: '100%',
              padding: '0.75rem',
              background: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              color: '#e8e8e8',
              fontSize: '0.95rem',
            }}
          />
          <p style={{ fontSize: '0.8rem', marginTop: '0.5rem', opacity: 0.6 }}>
            Get your API key from{' '}
            <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" style={{ color: '#9333ea' }}>
              openrouter.ai
            </a>
          </p>
        </div>
      )}

      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', opacity: 0.9 }}>
          Image Generation Model
        </label>
        <select
          value={settings.generationModel}
          onChange={(e) => updateSettings({ generationModel: e.target.value })}
          style={{
            width: '100%',
            padding: '0.75rem',
            background: 'rgba(0, 0, 0, 0.3)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '8px',
            color: '#e8e8e8',
            fontSize: '0.95rem',
            cursor: 'pointer',
          }}
        >
          {settings.apiProvider === 'gemini' ? (
            <>
              <option value="gemini-2.5-flash-image">Gemini 2.5 Flash Image - $0.039/image (Fast)</option>
              <option value="gemini-3-pro-image-preview">Gemini 3 Pro Image - Higher quality, 2K resolution</option>
            </>
          ) : (
            <>
              <option value="google/gemini-2.5-flash-image">Gemini 2.5 Flash - ~$0.003/image (Cheapest)</option>
              <option value="openai/gpt-5-image-mini">GPT-5 Image Mini - ~$0.0035/image</option>
              <option value="google/gemini-3-pro-image-preview">Gemini 3 Pro - ~$0.013/image (Best Quality)</option>
            </>
          )}
        </select>
        <p style={{ fontSize: '0.8rem', marginTop: '0.5rem', opacity: 0.6 }}>
          {settings.apiProvider === 'gemini'
            ? 'Gemini Direct models support multi-image blending. Pro model generates 2K resolution images.'
            : 'Choose the AI model for generating tarot card images. Costs are approximate per image.'}
        </p>
      </div>

      {settings.apiProvider === 'gemini' && settings.generationModel.includes('gemini-3-pro') && (
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', opacity: 0.9 }}>
            Image Resolution
          </label>
          <select
            value={settings.imageSize || '2K'}
            onChange={(e) => updateSettings({ imageSize: e.target.value as '1K' | '2K' })}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              color: '#e8e8e8',
              fontSize: '0.95rem',
              cursor: 'pointer',
            }}
          >
            <option value="1K">1K (1024×1024) - Faster</option>
            <option value="2K">2K (2048×2048) - Higher Quality</option>
          </select>
          <p style={{ fontSize: '0.8rem', marginTop: '0.5rem', opacity: 0.6 }}>
            Higher resolution provides better detail but takes longer to generate
          </p>
        </div>
      )}

      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', opacity: 0.9 }}>
          Card Info on Hover
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showCardInfo}
            onChange={(e) => updateSettings({ showCardInfo: e.target.checked })}
            style={{ width: '18px', height: '18px' }}
          />
          <div>
            <div style={{ fontSize: '0.95rem' }}>
              Show card name and number on hover
            </div>
            <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>
              Toggle off for surprise mode—cards stay mysterious until you open them.
            </div>
          </div>
        </label>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', opacity: 0.9 }}>
          Card Number Display
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={settings.showCardNumbers !== false}
            onChange={(e) => updateSettings({ showCardNumbers: e.target.checked })}
            style={{ width: '18px', height: '18px' }}
          />
          <div>
            <div style={{ fontSize: '0.95rem' }}>
              Show card numbers on cards
            </div>
            <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>
              Toggle off to show mystical symbol (✦) instead—for truly random selection.
            </div>
          </div>
        </label>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', opacity: 0.9 }}>
          Arrow Navigation (Detail View)
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={navWithArrows}
            onChange={(e) => updateSettings({ navigateWithArrows: e.target.checked })}
            style={{ width: '18px', height: '18px' }}
          />
          <div>
            <div style={{ fontSize: '0.95rem' }}>
              {navWithArrows ? 'Arrow keys/buttons enabled' : 'Arrow navigation disabled'}
            </div>
            <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>
              Toggle left/right arrow navigation and buttons in the card detail view.
            </div>
          </div>
        </label>
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', opacity: 0.9 }}>
          Prompt Suffix (style modifiers)
        </label>
        <textarea
          value={settings.promptSuffix}
          onChange={(e) => updateSettings({ promptSuffix: e.target.value })}
          placeholder=", highly detailed, cinematic lighting..."
          rows={3}
          style={{
            width: '100%',
            padding: '0.75rem',
            background: 'rgba(0, 0, 0, 0.3)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '8px',
            color: '#e8e8e8',
            fontSize: '0.9rem',
            fontFamily: 'monospace',
            resize: 'vertical',
          }}
        />
      </div>
    </section>
  );
}
