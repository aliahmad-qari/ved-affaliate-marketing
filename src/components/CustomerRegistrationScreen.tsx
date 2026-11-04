import React from 'react';
import { UserRound, Smartphone, ShieldCheck, LockKeyhole, Handshake, Zap, ArrowRight, CircleCheck } from 'lucide-react';

export interface RegistrationScreenProps {
  registered?: boolean;
  token?: string;
  action?: string;
  error?: string;
  name?: string;
  mobile?: string;
  consent?: boolean;
}

// Shared by the server-rendered, progressively enhanced form and isolated previews.
export function CustomerRegistrationScreen({ registered = false, token = '', action = '', error = '', name = '', mobile = '', consent = false }: RegistrationScreenProps) {
  return <div className="registration-page">
    <div className="registration-shell">
      <header className="registration-brand"><a href="/" aria-label="VED Affiliate homepage"><span className="ved-seal">VED</span><span className="ved-wordmark">VED <b>AFFILIATE</b></span></a><span className="registration-motto">Promote <i>•</i> Earn <i>•</i> Grow</span></header>
      <section className="registration-hero" aria-labelledby="registration-title">
        <h1 id="registration-title">Unlock <LockKeyhole aria-hidden="true"/><strong>Success</strong></h1>
        <p>Enter your details below to continue,<br/>we will redirect to <b>main page.</b></p>
      </section>
      <main className="registration-card">
        <div className="registration-trust"><ShieldCheck aria-hidden="true"/> Secure &amp; Trusted</div>
        {error && <p className="registration-error" role="alert">{error}</p>}
        <form method="post" action={action} data-registration-form="true">
          {!registered && <input type="hidden" name="captureToken" value={token}/>}
          <div className="registration-field"><span className="field-medallion"><UserRound aria-hidden="true"/></span><div><label htmlFor="customer-name">Full Name</label><div className="registration-input"><input id="customer-name" name="clientName" autoComplete="name" placeholder="Enter your full name" defaultValue={registered ? '' : name} minLength={2} maxLength={120} disabled={registered} required/><UserRound aria-hidden="true"/></div></div></div>
          <div className="registration-field"><span className="field-medallion"><Smartphone aria-hidden="true"/></span><div><label htmlFor="customer-mobile">Mobile Number</label><div className="registration-input"><input id="customer-mobile" name="clientMobile" type="tel" inputMode="tel" autoComplete="tel" placeholder="Enter 10-digit mobile number" defaultValue={registered ? '' : mobile} maxLength={20} disabled={registered} required/><Smartphone aria-hidden="true"/></div></div></div>
          {registered ? <><section className="registration-welcome" aria-live="polite"><CircleCheck className="registration-confirmation-icon" aria-hidden="true"/><div><h2>NUMBER ALREADY REGISTERED</h2><p>WELCOME BACK! YOUR APPLICATION IS ALREADY REGISTERED.</p></div></section><a className="registration-button registration-home-button" href="/">CONTINUE TO MAIN PAGE <ArrowRight aria-hidden="true"/></a></> : <>
            <label className="registration-consent"><input type="checkbox" name="consent" value="yes" defaultChecked={consent} required/><span>I agree that <b>VED Affiliate</b> may save my name and contact number and contact me regarding this application.</span></label>
            <button className="registration-button" type="submit"><span>CONTINUE SECURELY</span><ArrowRight aria-hidden="true"/></button>
            <p className="registration-progress" role="status" aria-live="polite"></p>
          </>}
        </form>
      </main>
      <footer className="registration-footer"><div className="registration-assurances"><span><ShieldCheck aria-hidden="true"/>Your Data<br/>is Safe</span><span><Handshake aria-hidden="true"/>Trusted<br/>Platform</span><span><Zap aria-hidden="true"/>Verified<br/>Tracking</span></div><svg className="registration-ribbon" viewBox="0 0 1024 100" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="registration-gold"><stop stopColor="#fff2af"/><stop offset=".25" stopColor="#d69b22"/><stop offset=".5" stopColor="#ffe697"/><stop offset=".75" stopColor="#b77c14"/><stop offset="1" stopColor="#ffe69b"/></linearGradient></defs><path fill="url(#registration-gold)" d="M0 0 C190 105 230 85 360 65 S580 40 730 68 S910 108 1024 20 L1024 76 C885 115 824 84 730 76 S510 33 360 72 S160 79 0 95Z"/><path fill="#f6d16b" opacity=".8" d="M0 38 C170 98 230 88 360 66 S570 40 730 69 S920 112 1024 45 L1024 51 C925 113 876 107 730 73 S520 37 360 71 S160 99 0 43Z"/></svg><p>TOGETHER FOR A GROWING FUTURE</p></footer>
    </div>
  </div>;
}
