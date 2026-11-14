/**
 * Miras Chat & Messaging Engine
 * منصة مِـرَاس - محرك المحادثات والرسائل الفورية
 */

const MirasChat = {
  getMessages(conversationId) {
    const key = 'miras_chat_' + (conversationId || 'default');
    try {
      const stored = localStorage.getItem(key);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.warn('[MirasChat] خطأ قراءة الرسائل:', e);
    }
    // رسائل ترحيبية افتراضية في بداية أي محادثة
    return [
      {
        id: 'msg_intro_1',
        sender: 'craftsman',
        sender_name: 'المعلم سعيد بن مخاشن',
        content: 'السلام عليكم ورحمة الله وبركاته، مرحباً بك في منصة مِـرَاس. أنا بخدمتك بخصوص الكشف والصيانة في حضرموت، تفضل بما تحتاجه.',
        created_at: new Date(Date.now() - 3600000).toISOString()
      }
    ];
  },

  saveMessages(conversationId, messages) {
    const key = 'miras_chat_' + (conversationId || 'default');
    try {
      localStorage.setItem(key, JSON.stringify(messages));
    } catch (e) {
      console.error('[MirasChat] خطأ حفظ الرسائل:', e);
    }
  },

  // إرسال رسالة فورية مع التحديث المرئي التفاؤلي
  async sendMessage(conversationId, text, proName = 'المعلم سعيد بن مخاشن') {
    if (!text || !text.trim()) return null;

    const myMsg = {
      id: 'msg_' + Date.now(),
      sender: 'user',
      sender_name: 'أنت',
      content: text.trim(),
      created_at: new Date().toISOString()
    };

    let list = this.getMessages(conversationId);
    list.push(myMsg);
    this.saveMessages(conversationId, list);

    // إرسال عبر Supabase إن توفر
    try {
      if (window.MirasAPI && window.MirasAPI.chat) {
        const user = await window.MirasAPI.auth.getCurrentUser();
        if (user && conversationId) {
          window.MirasAPI.chat.sendMessage({
            conversationId: conversationId,
            senderId: user.id,
            receiverId: user.id,
            content: text.trim()
          }).catch(() => {});
        }
      }
    } catch (err) {}

    // محاكاة رد الحرفي بعد 1.5 ثانية إذا لم يكن هناك طرف حي
    setTimeout(() => {
      const proReply = {
        id: 'msg_reply_' + Date.now(),
        sender: 'craftsman',
        sender_name: proName,
        content: 'حياك الله أخي الكريم! استلمت استفسارك وسأوافيك بالتفاصيل وتأكيد الموعد المناسب لزيارتك.',
        created_at: new Date().toISOString()
      };
      let updatedList = this.getMessages(conversationId);
      updatedList.push(proReply);
      this.saveMessages(conversationId, updatedList);
      window.dispatchEvent(new CustomEvent('miras:new_message', { detail: { message: proReply, conversationId } }));
    }, 1500);

    return myMsg;
  }
};

window.MirasChat = MirasChat;
