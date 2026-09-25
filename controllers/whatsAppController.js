const whatsAppService = require("../services/whatsAppService");

/**
 * @desc Get WhatsApp Cloud API Configuration Status
 * @route GET /api/whatsapp/status
 */
exports.getWhatsAppStatus = async (req, res) => {
  try {
    const config = whatsAppService.getConfig();
    return res.status(200).json({
      success: true,
      configured: config.isConfigured,
      phoneNumberIdConfigured: Boolean(config.phoneNumberId),
      tokenConfigured: Boolean(config.token),
      apiVersion: config.apiVersion,
      templateConfigured: Boolean(config.templateName),
      templateName: config.templateName || null,
      templateLanguage: config.templateLang,
      endpoint: config.endpoint,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve WhatsApp status",
      error: error.message,
    });
  }
};

/**
 * @desc Send a test WhatsApp welcome template message to verify Meta WhatsApp Cloud API
 * @route POST /api/whatsapp/test
 * @body { phoneNumber: string, userName?: string }
 */
exports.sendTestWhatsAppMessage = async (req, res) => {
  try {
    const recipientPhone = req.body.phoneNumber || req.body.phone;
    const recipientName = req.body.userName || req.body.name || "Test Member";

    if (!recipientPhone) {
      return res.status(400).json({
        success: false,
        message: "Recipient phoneNumber is required (e.g. 919876543210 or 9876543210)",
      });
    }

    const config = whatsAppService.getConfig();
    if (!config.phoneNumberId || !config.token) {
      return res.status(500).json({
        success: false,
        message: "WhatsApp Cloud API credentials (WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN) are not configured in backend environment.",
      });
    }

    if (!config.templateName) {
      return res.status(400).json({
        success: false,
        message: "No WHATSAPP_WELCOME_TEMPLATE_NAME configured in backend environment.",
      });
    }

    const result = await whatsAppService.sendRegistrationWelcomeMessage({
      phoneNumber: recipientPhone,
      userName: recipientName,
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Failed to send WhatsApp message via Meta Cloud API",
        details: result.error,
      });
    }

    return res.status(200).json({
      success: true,
      message: "WhatsApp test welcome template sent successfully",
      recipient: whatsAppService.maskPhoneNumber(
        whatsAppService.normalizeWhatsAppPhoneNumber(recipientPhone)
      ),
      messageId: result.messageId,
      data: result,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Exception while sending WhatsApp test message",
      error: error.message,
    });
  }
};
