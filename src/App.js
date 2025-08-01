import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import './App.css';

function App() {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [socket, setSocket] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  // Check if device is mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Auto-close sidebar on mobile when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isMobile && sidebarOpen) {
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.querySelector('.sidebar-overlay');
        
        if (sidebar && !sidebar.contains(event.target) && 
            overlay && !overlay.contains(event.target)) {
          setSidebarOpen(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isMobile, sidebarOpen]);

  // Auto-close sidebar when switching to mobile
  useEffect(() => {
    if (isMobile && sidebarOpen) {
      setSidebarOpen(false);
    }
  }, [isMobile, sidebarOpen]);

  // Add swipe gesture to close sidebar on mobile
  useEffect(() => {
    if (!isMobile) return;

    let startX = 0;
    let startY = 0;
    let isSwiping = false;

    const handleTouchStart = (e) => {
      if (sidebarOpen) {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        isSwiping = true;
      }
    };

    const handleTouchMove = (e) => {
      if (!isSwiping) return;

      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      const diffX = startX - currentX;
      const diffY = Math.abs(startY - currentY);

      // Only trigger if it's a horizontal swipe and not too vertical
      if (diffX > 50 && diffY < 100) {
        setSidebarOpen(false);
        isSwiping = false;
      }
    };

    const handleTouchEnd = () => {
      isSwiping = false;
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isMobile, sidebarOpen]);

  useEffect(() => {
    // Initialize socket connection
    const newSocket = io('http://localhost:5000');
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to server');
      setIsConnected(true);
      addMessage('🎉 Welcome to ModuMentor AI Assistant! I\'m here to help you with weather, lyrics, web searches, emails, and much more. How can I assist you today?', 'system');
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
      setIsConnected(false);
      addMessage('⚠️ Connection lost. Trying to reconnect...', 'system');
    });

    newSocket.on('message', (data) => {
      addMessage(data.message, 'bot');
    });

    return () => newSocket.close();
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const addMessage = (message, type) => {
    const newMessage = {
      id: Date.now(),
      text: message,
      type: type,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setIsLoading(true);

    // Close sidebar on mobile after sending message
    if (isMobile && sidebarOpen) {
      setSidebarOpen(false);
    }

    // Add user message to chat
    addMessage(userMessage, 'user');

    try {
      // Send via REST API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          user_id: 'web-user'
        })
      });

      const data = await response.json();
      
      if (data.response) {
        addMessage(data.response, 'bot');
      } else if (data.error) {
        addMessage(`❌ Error: ${data.error}`, 'system');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      addMessage('❌ Failed to send message. Please try again.', 'system');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Auto-resize textarea
  const handleTextareaChange = (e) => {
    setInputMessage(e.target.value);
    
    // Auto-resize textarea
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  };

  // Reset textarea height when message is sent
  useEffect(() => {
    if (!inputMessage) {
      const textarea = document.querySelector('.input-wrapper textarea');
      if (textarea) {
        textarea.style.height = 'auto';
      }
    }
  }, [inputMessage]);

  const clearChat = async () => {
    try {
      const response = await fetch('/api/clear', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: 'web-user' })
      });

      const data = await response.json();
      
      if (data.success) {
        setMessages([]);
        addMessage('🗑️ Chat history cleared successfully!', 'system');
      } else {
        addMessage('❌ Failed to clear chat history', 'system');
      }
    } catch (error) {
      console.error('Error clearing chat:', error);
      addMessage('❌ Failed to clear chat history', 'system');
    }
  };

  const getHelp = async () => {
    try {
      const response = await fetch('/api/help', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: 'web-user' })
      });

      const data = await response.json();
      
      if (data.response) {
        addMessage(data.response, 'bot');
      } else if (data.error) {
        addMessage(`❌ Error: ${data.error}`, 'system');
      }
    } catch (error) {
      console.error('Error getting help:', error);
      addMessage('❌ Failed to get help information', 'system');
    }
  };

  const testTools = async () => {
    try {
      const response = await fetch('/api/test-tools', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: 'web-user' })
      });

      const data = await response.json();
      
      if (data.test_results) {
        const toolResults = Object.entries(data.test_results)
          .map(([tool, result]) => `${result.status === 'success' ? '✅' : '❌'} **${tool}**: ${result.response}`)
          .join('\n');
        addMessage(`🔧 **Tool Test Results:**\n\n${toolResults}`, 'bot');
      } else if (data.error) {
        addMessage(`❌ Error: ${data.error}`, 'system');
      }
    } catch (error) {
      console.error('Error testing tools:', error);
      addMessage('❌ Failed to test tools', 'system');
    }
  };

  const analyzeConversation = async () => {
    try {
      const response = await fetch('/api/analyze-conversation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: 'web-user' })
      });

      const data = await response.json();
      
      if (data.response) {
        addMessage(data.response, 'bot');
      } else if (data.error) {
        addMessage(`❌ Error: ${data.error}`, 'system');
      }
    } catch (error) {
      console.error('Error analyzing conversation:', error);
      addMessage('❌ Failed to analyze conversation', 'system');
    }
  };

  const formatMessage = (text) => {
    // Enhanced markdown-like formatting with link support
    return text
      // Handle markdown links: [text](url)
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="chat-link">$1</a>')
      // Handle bold text: **text**
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Handle italic text: *text*
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Handle code: `code`
      .replace(/`(.*?)`/g, '<code>$1</code>')
      // Handle line breaks
      .replace(/\n/g, '<br>');
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <div className="App">
      <div className="chat-container">
        {/* Sidebar */}
        <div className={`sidebar ${sidebarOpen ? 'show' : ''}`}>
          <div className="sidebar-header">
            <h2>🤖 ModuMentor</h2>
            <p>Intelligent AI Assistant</p>
          </div>
          
          <div className="sidebar-actions">
            <button className="action-btn" onClick={getHelp}>
              <span>❓</span>
              Help & Commands
            </button>
            <button className="action-btn" onClick={testTools}>
              <span>🔧</span>
              Test Tools
            </button>
            <button className="action-btn" onClick={analyzeConversation}>
              <span>📊</span>
              Analyze Chat
            </button>
            <button className="action-btn" onClick={clearChat}>
              <span>🗑️</span>
              Clear Chat
            </button>
          </div>
          
          <div style={{ marginTop: 'auto', padding: '20px 0', textAlign: 'center', opacity: 0.7 }}>
            <div style={{ fontSize: '0.8rem', marginBottom: '10px' }}>
              {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
            </div>
            <div style={{ fontSize: '0.7rem' }}>
              Powered by AI
            </div>
          </div>
        </div>

        {/* Sidebar overlay for mobile */}
        <div 
          className={`sidebar-overlay ${sidebarOpen ? 'show' : ''}`}
          onClick={() => setSidebarOpen(false)}
        ></div>

        {/* Main chat area */}
        <div className="chat-main">
          {/* Header */}
          <div className="chat-header">
            <button 
              className="mobile-menu-toggle"
              onClick={toggleSidebar}
              aria-label="Toggle menu"
            >
              <span>☰</span>
            </button>
            <h1>💬 ModuMentor Chat</h1>
            <div className="header-actions">
              <button className="header-btn" onClick={getHelp} title="Help">
                <span>❓</span>
              </button>
              <button className="header-btn" onClick={analyzeConversation} title="Analyze Conversation">
                <span>📊</span>
              </button>
              <button className="header-btn" onClick={clearChat} title="Clear Chat">
                <span>🗑️</span>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="messages-container" ref={chatContainerRef}>
            {messages.length === 0 && (
              <div className="message bot">
                <div className="message-content">
                  <div className="message-text">
                    <strong>🎉 Welcome to ModuMentor AI Assistant!</strong><br/><br/>
                    I'm your intelligent AI companion with powerful capabilities:<br/><br/>
                    🌤️ <strong>Weather Information</strong> - Get real-time weather data<br/>
                    🎵 <strong>Lyrics Search</strong> - Find song lyrics with professional guidance<br/>
                    🔍 <strong>Web Search</strong> - Professional analysis with clickable links<br/>
                    📧 <strong>Email Management</strong> - Send professional emails<br/>
                    📊 <strong>Conversation Analysis</strong> - Get detailed chat insights<br/><br/>
                    <em>Try asking me anything! For example:</em><br/>
                    • "weather of delhi"<br/>
                    • "lyrics of shape of you"<br/>
                    • "tell me about artificial intelligence"<br/>
                    • "send email to john about project update"
                  </div>
                </div>
              </div>
            )}
            
            {messages.map((message) => (
              <div key={message.id} className={`message ${message.type}`}>
                <div className="message-content">
                  <div 
                    className="message-text"
                    dangerouslySetInnerHTML={{ 
                      __html: formatMessage(message.text) 
                    }}
                  ></div>
                  <div className="message-time">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="message bot">
                <div className="message-content">
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="input-container">
            <div className="input-wrapper">
              <textarea
                value={inputMessage}
                onChange={handleTextareaChange}
                onKeyPress={handleKeyPress}
                placeholder="Type your message here... (Press Enter to send, Shift+Enter for new line)"
                disabled={isLoading}
                rows={1}
                aria-label="Message input"
              />
              <button 
                className="send-btn" 
                onClick={sendMessage}
                disabled={!inputMessage.trim() || isLoading}
                title="Send Message"
                aria-label="Send message"
              >
                <span>➤</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App; 