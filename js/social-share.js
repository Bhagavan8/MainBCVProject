class SocialShare {
    constructor() {
        this.init();
    }

    init() {
        this.createSocialBar();
    }

    createSocialBar() {
        const sidebar = document.createElement('div');
        sidebar.className = 'social-share-sidebar';
        sidebar.setAttribute('aria-label', 'Social media links');
        
        const socialButtons = [
            {
                name: 'facebook',
                icon: 'bi-facebook',
                url: 'https://www.facebook.com/profile.php?id=61575272554223',
                label: 'Follow BCVWorld on Facebook'
            },
            {
                name: 'linkedin',
                icon: 'bi-linkedin',
                url: 'https://www.linkedin.com/in/bcv-world-7a294235a/',
                label: 'Connect with BCVWorld on LinkedIn'
            },
            {
                name: 'instagram',
                icon: 'bi-instagram',
                url: 'https://www.instagram.com/bcvworld18/',
                label: 'Follow BCVWorld on Instagram'
            },
            {
                name: 'email',
                icon: 'bi-envelope-fill',
                url: 'mailto:help.bcv@bcvworld.com',
                label: 'Email BCVWorld at help.bcv@bcvworld.com'
            },
            {
                name: 'whatsapp',
                icon: 'bi-whatsapp',
                url: 'https://whatsapp.com/channel/0029VasadwXLikgEikBhWE1o',
                label: 'Join BCVWorld\'s WhatsApp channel'
            },
            {
                name: 'telegram',
                icon: 'bi-telegram',
                url: 'https://t.me/bcvworld',
                label: 'Join BCVWorld\'s Telegram channel'
            },
            {
                name: 'github',
                icon: 'bi-github',
                url: 'https://github.com/bcvworld',
                label: 'Visit BCVWorld on GitHub'
            }
        ];

        socialButtons.forEach(button => {
            const link = document.createElement('a');
            link.href = button.url;
            link.className = `social-share-btn ${button.name}`;
            link.target = button.name === 'email' ? '_self' : '_blank';
            link.rel = 'noopener noreferrer';
            link.setAttribute('aria-label', button.label);
            
            const icon = document.createElement('i');
            icon.className = `bi ${button.icon}`;
            icon.setAttribute('aria-hidden', 'true');
            
            const srText = document.createElement('span');
            srText.className = 'visually-hidden';
            srText.textContent = button.label;
            
            link.appendChild(icon);
            link.appendChild(srText);
            sidebar.appendChild(link);
        });

        document.body.appendChild(sidebar);
    }
}

// Initialize social share
document.addEventListener('DOMContentLoaded', () => {
    new SocialShare();
});