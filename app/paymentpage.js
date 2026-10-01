import { useState } from 'react';
import { Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMenu } from './menucontext';

const paymentOptions = [
    { id: 'cash', label: 'Cash', detail: 'Enter amount received' },
    { id: 'cashless', label: 'Cashless', detail: 'Exact amount, manual record' },
];

const keypadRows = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['.', '0', 'DEL'],
];

const MAX_AMOUNT_LENGTH = 9;

export default function Payment() {
    const { pendingOrder, completePendingOrder } = useMenu();
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [amountText, setAmountText] = useState('');
    const [message, setMessage] = useState('');
    const [receipt, setReceipt] = useState(null);

    const total = pendingOrder ? pendingOrder.subtotal : 0;
    const isCash = paymentMethod === 'cash';
    const tendered = isCash ? Number.parseFloat(amountText) || 0 : total;
    const difference = roundMoney(tendered - total);
    const canPay = Boolean(pendingOrder) && (isCash ? tendered > 0 && difference >= 0 : true);

    function pressKey(key) {
        setMessage('');

        setAmountText((current) => {
            if (key === 'DEL') return current.slice(0, -1);
            if (key === 'CLEAR') return '';
            if (current.length >= MAX_AMOUNT_LENGTH) return current;

            if (key === '.') {
                if (current.includes('.')) return current;
                return current === '' ? '0.' : `${current}.`;
            }

            if (current.includes('.') && current.split('.')[1].length >= 2) return current;
            if (current === '0') return key;

            return current + key;
        });
    }

    function useExactAmount() {
        setMessage('');
        setAmountText(String(total));
    }

    function confirmPayment() {
        if (!canPay || receipt) return;

        const transactionId = createTransactionId(pendingOrder.orderNumber);
        const amountTendered = roundMoney(tendered);
        const change = Math.max(0, roundMoney(amountTendered - total));

        const result = completePendingOrder(paymentMethod, { transactionId, amountTendered, change });

        if (!result.completed) {
            setMessage(result.missing
                ? `Not enough stock: ${result.missing.map(formatMissingIngredient).join(', ')}.`
                : result.message);
            return;
        }

        setReceipt({
            ...result.order,
            transactionId,
            amountTendered,
            change,
            paymentMethod,
        });
    }

    function finishReceipt() {
        setReceipt(null);
        router.replace('/menudashboard');
    }

    if (!pendingOrder && !receipt) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <StatusBar style="dark" />
                <View style={styles.emptyState}>
                    <Pressable onPress={() => router.replace('/menudashboard')} style={styles.actionButton}>
                        <Text style={styles.actionButtonText}>RETURN TO ORDER DESK</Text>
                    </Pressable>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar style="dark" />
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.topBar}>
                    <View>
                        <Text style={styles.title}>Payment</Text>
                        {pendingOrder ? <Text style={styles.subtitle}>{pendingOrder.orderNumber}  |  {pendingOrder.itemCount} item{pendingOrder.itemCount === 1 ? '' : 's'}</Text> : null}
                    </View>
                    <Pressable accessibilityLabel="Back to order summary" onPress={() => router.back()} style={styles.closeButton}>
                        <Text style={styles.closeButtonText}>X</Text>
                    </Pressable>
                </View>

                <View style={styles.paymentGrid}>
                    {paymentOptions.map((option) => (
                        <Pressable
                            key={option.id}
                            onPress={() => {
                                setPaymentMethod(option.id);
                                setMessage('');
                            }}
                            style={[styles.paymentOption, paymentMethod === option.id && styles.paymentOptionActive]}
                        >
                            <Text style={[styles.paymentOptionTitle, paymentMethod === option.id && styles.paymentOptionTitleActive]}>{option.label}</Text>
                            <Text style={[styles.paymentOptionDetail, paymentMethod === option.id && styles.paymentOptionDetailActive]}>{option.detail}</Text>
                        </Pressable>
                    ))}
                </View>

                <View style={styles.amountPanel}>
                    <View style={styles.amountRow}>
                        <Text style={styles.amountLabel}>TOTAL DUE</Text>
                        <Text style={styles.amountValue}>{formatMoney(total)}</Text>
                    </View>
                    <View style={styles.amountRow}>
                        <Text style={styles.amountLabel}>AMOUNT RECEIVED</Text>
                        <Text style={styles.tenderedValue}>{isCash ? `₱${amountText || '0'}` : formatMoney(total)}</Text>
                    </View>
                    <View style={[styles.amountRow, styles.amountRowLast]}>
                        <Text style={styles.amountLabel}>{difference < 0 ? 'STILL DUE' : 'CHANGE'}</Text>
                        <Text style={[styles.changeValue, difference < 0 && isCash && styles.changeValueShort]}>
                            {isCash && !amountText ? '--' : formatMoney(Math.abs(difference))}
                        </Text>
                    </View>
                </View>

                {isCash ? (
                    <View style={styles.keypad}>
                        {keypadRows.map((row) => (
                            <View key={row.join('')} style={styles.keypadRow}>
                                {row.map((key) => (
                                    <Pressable
                                        key={key}
                                        onPress={() => pressKey(key)}
                                        style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
                                    >
                                        <Text style={styles.keyText}>{key === 'DEL' ? '<-' : key}</Text>
                                    </Pressable>
                                ))}
                            </View>
                        ))}
                        <View style={styles.keypadRow}>
                            <Pressable onPress={useExactAmount} style={({ pressed }) => [styles.key, styles.keyWide, pressed && styles.keyPressed]}>
                                <Text style={styles.keyTextSmall}>EXACT</Text>
                            </Pressable>
                            <Pressable onPress={() => pressKey('CLEAR')} style={({ pressed }) => [styles.key, styles.keyWide, pressed && styles.keyPressed]}>
                                <Text style={styles.keyTextSmall}>CLEAR</Text>
                            </Pressable>
                        </View>
                    </View>
                ) : null}

                {message ? <Text style={styles.message}>{message}</Text> : null}

                <Pressable
                    disabled={!canPay}
                    onPress={confirmPayment}
                    style={[styles.actionButton, !canPay && styles.actionButtonDisabled]}
                >
                    <Text style={styles.actionButtonText}>
                        {isCash && !canPay && amountText ? 'AMOUNT IS NOT ENOUGH' : `CONFIRM ${paymentMethod.toUpperCase()} PAYMENT`}
                    </Text>
                </Pressable>
            </ScrollView>

            {/* Receipt */}
            <Modal animationType="slide" transparent visible={Boolean(receipt)} onRequestClose={finishReceipt}>
                <View style={styles.modalBackdrop}>
                    <View style={styles.receiptSheet}>
                        {receipt ? (
                            <ScrollView showsVerticalScrollIndicator={false}>
                                <Text style={styles.receiptSub}>Payment received</Text>

                                <View style={styles.receiptDivider} />

                                <ReceiptRow label="Transaction ID" value={receipt.transactionId} stacked />
                                <ReceiptRow label="Order" value={receipt.orderNumber} />
                                <ReceiptRow label="Date" value={new Date(receipt.paidAt).toLocaleString()} />
                                <ReceiptRow label="Payment" value={formatPaymentMethod(receipt.paymentMethod)} />

                                <View style={styles.receiptDivider} />

                                {receipt.items.map((item) => (
                                    <View key={item.id} style={styles.receiptItem}>
                                        <Text style={styles.receiptItemName}>{item.quantity}x {item.name}</Text>
                                        <Text style={styles.receiptItemTotal}>{formatMoney(item.lineTotal)}</Text>
                                    </View>
                                ))}

                                <View style={styles.receiptDivider} />

                                <ReceiptRow label="Total" value={formatMoney(receipt.subtotal)} strong />
                                <ReceiptRow label="Amount received" value={formatMoney(receipt.amountTendered)} />
                                <ReceiptRow label="Change" value={formatMoney(receipt.change)} />

                                <View style={styles.receiptDivider} />
                                <Text style={styles.receiptThanks}>Thank you! Please come again.</Text>
                            </ScrollView>
                        ) : null}

                        <Pressable onPress={finishReceipt} style={styles.actionButton}>
                            <Text style={styles.actionButtonText}>DONE</Text>
                        </Pressable>
                        <Pressable style={styles.secondaryButton}>
                            <Text style={styles.secondaryButtonText}>PRINT RECEIPT</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

function ReceiptRow({ label, value, strong = false, stacked = false }) {
    return (
        <View style={stacked ? styles.receiptRowStacked : styles.receiptRow}>
            <Text style={styles.receiptLabel}>{label}</Text>
            <Text style={[styles.receiptValue, strong && styles.receiptValueStrong, stacked && styles.receiptValueStacked]}>{value}</Text>
        </View>
    );
}

// Example: TXN-20260930143012-001-K7QF
// Timestamp to the second + order number + 4 random characters.
function createTransactionId(orderNumber) {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, '0');
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase().padEnd(4, '0');
    return `TXN-${stamp}-${String(orderNumber).replace('#', '')}-${suffix}`;
}

function roundMoney(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatMoney(value) {
    return `₱${roundMoney(Number(value) || 0).toFixed(2)}`;
}

function formatPaymentMethod(paymentMethod) {
    return paymentMethod === 'cashless' ? 'Cashless' : 'Cash';
}

function formatMissingIngredient(ingredient) {
    const shortage = Math.max(0, ingredient.amount - ingredient.available);
    return `${ingredient.name} needs ${roundMoney(shortage)} ${ingredient.unit} more`;
}

const colors = {
    background: '#F6F2EC',
    ink: '#25170E',
    muted: '#817D75',
    terracotta: '#6D5236',
    border: '#DED6CB',
    panel: '#FFFDF9',
    danger: '#A33F32',
    success: '#76835A',
};

const styles = StyleSheet.create({
    safeArea: { backgroundColor: colors.background, flex: 1 },
    content: { padding: 24, paddingBottom: 42 },
    topBar: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 22 },
    title: { color: colors.ink, fontSize: 30, fontWeight: '800' },
    subtitle: { color: colors.muted, fontSize: 12, fontWeight: '700', marginTop: 4 },
    closeButton: { alignItems: 'center', borderColor: colors.border, borderRadius: 16, borderWidth: 1, height: 32, justifyContent: 'center', width: 32 },
    closeButtonText: { color: colors.ink, fontSize: 13, fontWeight: '800' },

    paymentGrid: { flexDirection: 'row', gap: 10 },
    paymentOption: { backgroundColor: colors.panel, borderColor: colors.border, borderRadius: 8, borderWidth: 1, flex: 1, minHeight: 78, padding: 14 },
    paymentOptionActive: { backgroundColor: colors.ink, borderColor: colors.ink },
    paymentOptionTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
    paymentOptionTitleActive: { color: '#FFF9F1' },
    paymentOptionDetail: { color: colors.muted, fontSize: 12, marginTop: 6 },
    paymentOptionDetailActive: { color: '#CFC7BB' },

    amountPanel: { backgroundColor: colors.panel, borderColor: colors.border, borderRadius: 9, borderWidth: 1, marginTop: 18, paddingHorizontal: 18 },
    amountRow: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14 },
    amountRowLast: { borderBottomWidth: 0 },
    amountLabel: { color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
    amountValue: { color: colors.ink, fontSize: 22, fontWeight: '800' },
    tenderedValue: { color: colors.terracotta, fontSize: 30, fontWeight: '800' },
    changeValue: { color: colors.success, fontSize: 22, fontWeight: '800' },
    changeValueShort: { color: colors.danger },

    keypad: { gap: 10, marginTop: 18 },
    keypadRow: { flexDirection: 'row', gap: 10 },
    key: { alignItems: 'center', backgroundColor: colors.panel, borderColor: colors.border, borderRadius: 10, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 62 },
    keyWide: { minHeight: 52 },
    keyPressed: { backgroundColor: '#EEE7DC' },
    keyText: { color: colors.ink, fontSize: 24, fontWeight: '700' },
    keyTextSmall: { color: colors.ink, fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },

    message: { color: colors.danger, fontSize: 12, lineHeight: 18, marginTop: 14 },
    actionButton: { alignItems: 'center', backgroundColor: colors.terracotta, borderRadius: 6, justifyContent: 'center', marginTop: 16, minHeight: 52 },
    actionButtonDisabled: { opacity: 0.45 },
    actionButtonText: { color: '#FFF9F1', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
    emptyState: { flex: 1, justifyContent: 'center', padding: 28 },

    modalBackdrop: { alignItems: 'center', backgroundColor: 'rgba(31, 29, 27, 0.55)', flex: 1, justifyContent: 'center', padding: 20 },
    receiptSheet: { backgroundColor: colors.panel, borderRadius: 14, maxHeight: '92%', maxWidth: 400, padding: 22, width: '100%' },
    receiptSub: { color: colors.muted, fontSize: 12, marginTop: 4, textAlign: 'center' },
    receiptDivider: { backgroundColor: colors.border, height: 1, marginVertical: 14 },
    receiptRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
    receiptRowStacked: { paddingVertical: 4 },
    receiptLabel: { color: colors.muted, fontSize: 12 },
    receiptValue: { color: colors.ink, fontSize: 13, fontWeight: '700' },
    receiptValueStrong: { fontSize: 16, fontWeight: '800' },
    receiptValueStacked: { fontSize: 13, letterSpacing: 0.5, marginTop: 3 },
    receiptItem: { flexDirection: 'row', gap: 10, justifyContent: 'space-between', paddingVertical: 4 },
    receiptItemName: { color: colors.ink, flex: 1, fontSize: 13 },
    receiptItemTotal: { color: colors.ink, fontSize: 13, fontWeight: '700' },
    receiptThanks: { color: colors.muted, fontSize: 12, textAlign: 'center' },
    secondaryButton: { alignItems: 'center', borderColor: colors.border, borderRadius: 6, borderWidth: 1, justifyContent: 'center', marginTop: 10, minHeight: 48 },
    secondaryButtonText: { color: colors.ink, fontSize: 11, fontWeight: '800', letterSpacing: 1.1 },
});